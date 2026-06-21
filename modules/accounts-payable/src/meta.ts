import { newCorrelationId, withMeta } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

export function accountsPayableMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "accounts-payable",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString()
  });
}
