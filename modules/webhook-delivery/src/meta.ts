import { withMeta, newCorrelationId } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

// Build a Result envelope Meta for a webhook-delivery use-case. correlationId is
// threaded from the caller (edge/dispatcher/source event) when present, otherwise
// minted. See Plan 25 §4.
export function webhookDeliveryMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "webhook-delivery",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString(),
  });
}
