import { withMeta, newCorrelationId } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

// Build a Result envelope Meta for an invoice use-case. correlationId is threaded
// from the caller (edge/dispatcher) when present, otherwise minted. See Plan 25 §4.
export function invoiceMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "invoice",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString(),
  });
}
