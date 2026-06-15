import { withMeta, newCorrelationId } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

// Result-envelope Meta for an identity use-case. correlationId threads from the caller
// (edge/dispatcher) when present, otherwise minted. Mirrors auth's authMeta (Plan 25 §4).
export function identityMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "identity",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString(),
  });
}
