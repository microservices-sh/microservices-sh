import { ok } from "@microservices-sh/connection-contract";
import { webhookDeliveryMeta } from "../meta";
import type { WebhookEndpointStore } from "../ports";

// Read endpoint inventory without returning signing secrets. The raw secret is
// only returned by registerEndpoint at creation time.
export async function listEndpoints(
  deps: { endpointStore: WebhookEndpointStore; now?: () => number; correlationId?: string }
) {
  const meta = webhookDeliveryMeta(deps);
  const endpoints = await deps.endpointStore.list();
  return ok(
    200,
    {
      endpoints: endpoints.map((endpoint) => ({
        id: endpoint.id,
        url: endpoint.url,
        eventNames: endpoint.eventNames,
        active: endpoint.active,
        createdAt: endpoint.createdAt
      })),
      count: endpoints.length
    },
    meta
  );
}
