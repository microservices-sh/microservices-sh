// Correlation IDs thread a single logical request across every hop (RPC, event,
// hook). Generated at the edge, propagated via the header below, and baked into
// event envelopes + hook contexts. See plans/25-module-connection-standard.md §4.

export const CORRELATION_HEADER = "x-msh-correlation-id";

// crypto.randomUUID is available in Cloudflare Workers and Node 18+.
export const newCorrelationId = () => crypto.randomUUID();

export function withMeta(partial) {
  return { ...partial, correlationId: partial.correlationId ?? newCorrelationId() };
}
