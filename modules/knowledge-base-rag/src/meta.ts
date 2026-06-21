import { newCorrelationId, withMeta } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

export function knowledgeBaseRagMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "knowledge-base-rag",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString()
  });
}
