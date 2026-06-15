import { withMeta, newCorrelationId } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";

// Build a Result envelope Meta for a jobs-workflows use-case. correlationId is
// threaded from the caller (edge/dispatcher/enqueuer) when present, otherwise
// minted, so a job and every retry/run share one trace. See Plan 25 §4.
export function jobsWorkflowsMeta(deps?: { correlationId?: string; now?: () => number }): Meta {
  return withMeta({
    source: "jobs-workflows",
    requestId: newCorrelationId(),
    correlationId: deps?.correlationId,
    ts: new Date(deps?.now?.() ?? Date.now()).toISOString(),
  });
}
