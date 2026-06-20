import { newCorrelationId, withMeta } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

export function agentDispatchMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "agent-dispatch",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString()
  });
}
