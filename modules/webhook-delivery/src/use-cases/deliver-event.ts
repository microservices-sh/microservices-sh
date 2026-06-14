import { afterWebhookDelivered, beforeWebhookDeliver } from "../hooks";
import { deliverEventInputSchema } from "../schemas";
import { signPayload } from "../signing";
import type { DeliveryLogStore, HttpClient, WebhookEndpointStore } from "../ports";
import type { DeliveryAttempt, DomainEvent } from "../types";

// Fan a domain event out to every active matching endpoint. For each one:
// HMAC-sign the JSON body with the endpoint secret, POST via the injected http
// client with X-Signature + X-Idempotency-Id headers, record the attempt, and
// emit webhook.delivered / webhook.failed. Non-2xx is treated as failed.
export async function deliverEvent(
  input: unknown,
  deps: { endpointStore: WebhookEndpointStore; deliveryLog: DeliveryLogStore; httpClient: HttpClient; now?: () => number }
) {
  const parsed = deliverEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_EVENT_INPUT", message: "Outbound event input is invalid.", issues: parsed.error.issues }
    };
  }

  const event = await beforeWebhookDeliver(parsed.data);
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
    let error: string | null = null;
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
      if (!delivered) error = `Non-2xx response: ${response.status}`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "delivery threw";
    }

    const attempt: DeliveryAttempt = {
      id: idempotencyId,
      endpointId: endpoint.id,
      eventName: event.eventName,
      status: delivered ? "delivered" : "failed",
      statusCode,
      error,
      createdAt: timestamp
    };
    await deps.deliveryLog.append(attempt);
    await afterWebhookDelivered(attempt);
    attempts.push(attempt);
    events.push({
      name: delivered ? "webhook.delivered" : "webhook.failed",
      payload: { deliveryId: attempt.id, endpointId: endpoint.id, eventName: event.eventName, statusCode }
    });
  }

  return {
    ok: true as const,
    status: 200 as const,
    data: {
      eventName: event.eventName,
      matched: endpoints.length,
      delivered: attempts.filter((attempt) => attempt.status === "delivered").length,
      failed: attempts.filter((attempt) => attempt.status === "failed").length,
      attempts,
      events
    }
  };
}
