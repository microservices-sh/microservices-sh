import { withMeta, newCorrelationId } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

// Build a Result envelope Meta for a support-ticket use-case. correlationId is
// threaded from the caller (edge/dispatcher) when present, otherwise minted.
// See plans/25-module-connection-standard.md section 4.
export function supportTicketMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "support-ticket",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString()
  });
}
