import { withMeta, newCorrelationId } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

// Build a Result envelope Meta for an image-generation use-case. correlationId is
// threaded from the caller (edge/dispatcher) when present, otherwise minted.
export function imageGenerationMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "image-generation",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString(),
  });
}
