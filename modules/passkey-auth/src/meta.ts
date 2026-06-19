import { withMeta, newCorrelationId } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

// Result-envelope Meta for a passkey-auth use-case. correlationId threads from the
// caller (edge/dispatcher) when present, otherwise minted. Mirrors identity's
// identityMeta (Plan 25 §4).
export function passkeyMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "passkey-auth",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString(),
  });
}
