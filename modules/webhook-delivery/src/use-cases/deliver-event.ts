import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { afterWebhookDelivered, beforeWebhookDeliver } from "../hooks";
import { deliverEventInputSchema } from "../schemas";
import { webhookDeliveryMeta } from "../meta";
import { signPayload } from "../signing";
import type { DeliveryLogStore, HttpClient, WebhookEndpointStore } from "../ports";
import type { DeliveryAttempt, DomainEvent } from "../types";

// Fan a domain event out to every active matching endpoint. For each one:
// HMAC-sign the JSON body with the endpoint secret, POST via the injected http
// client with X-Signature + X-Idempotency-Id headers, record the attempt, and
// emit webhook.delivered / webhook.failed. Non-2xx is treated as failed.
//
// As a sink, the source domain event's correlationId is threaded in via
// deps.correlationId so the outbound emitted events stitch to the same trace.
//
// Two layers of customization run before delivery:
//   1. the local config seam `beforeWebhookDeliver` (per-app override)
//   2. the cross-module `beforeWebhookDeliver` hook chain (Plan 25 §5),
//      injected by the composed app via deps.beforeDeliverHooks — filters may
//      mutate the outbound event, guards may veto delivery.
export async function deliverEvent(
  input: unknown,
  deps: {
    endpointStore: WebhookEndpointStore;
    deliveryLog: DeliveryLogStore;
    httpClient: HttpClient;
    now?: () => number;
    correlationId?: string;
    beforeDeliverHooks?: ResolvedHook[];
  }
) {
  const meta = webhookDeliveryMeta(deps);

  const parsed = deliverEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "webhook-delivery.INVALID_EVENT_INPUT",
        message: "Outbound event input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const configData = await beforeWebhookDeliver(parsed.data);
  const hooked = await runHooks(
    "beforeWebhookDeliver",
    configData,
    { correlationId: meta.correlationId },
    deps.beforeDeliverHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
  }
  const event = hooked.value as typeof configData;

  const endpoints = await deps.endpointStore.listMatching(event.eventName);

  const body = JSON.stringify({
    eventName: event.eventName,
    entityType: event.entityType,
    entityId: event.entityId,
    payload: event.payload
  });

  const attempts: DeliveryAttempt[] = [];
  const events: DomainEvent[] = [];

  for (const endpoint of endpoints) {
    const idempotencyId = "whd_" + crypto.randomUUID().slice(0, 16);
    const signature = await signPayload(body, endpoint.secret);
    const timestamp = new Date(deps.now?.() ?? Date.now()).toISOString();

    let statusCode: number | null = null;
    let attemptError: string | null = null;
    let delivered = false;
    try {
      const response = await deps.httpClient.post(endpoint.url, body, {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Idempotency-Id": idempotencyId,
        "X-Event-Name": event.eventName
      });
      statusCode = response.status;
      delivered = response.ok && response.status >= 200 && response.status < 300;
      if (!delivered) attemptError = `Non-2xx response: ${response.status}`;
    } catch (caught) {
      attemptError = caught instanceof Error ? caught.message : "delivery threw";
    }

    const attempt: DeliveryAttempt = {
      id: idempotencyId,
      endpointId: endpoint.id,
      eventName: event.eventName,
      status: delivered ? "delivered" : "failed",
      statusCode,
      error: attemptError,
      createdAt: timestamp
    };
    await deps.deliveryLog.append(attempt);
    await afterWebhookDelivered(attempt);
    attempts.push(attempt);
    events.push({
      name: delivered ? "webhook.delivered" : "webhook.failed",
      correlationId: meta.correlationId,
      payload: { deliveryId: attempt.id, endpointId: endpoint.id, eventName: event.eventName, statusCode }
    });
  }

  return ok(
    200,
    {
      eventName: event.eventName,
      matched: endpoints.length,
      delivered: attempts.filter((attempt) => attempt.status === "delivered").length,
      failed: attempts.filter((attempt) => attempt.status === "failed").length,
      attempts,
      events
    },
    meta
  );
}
