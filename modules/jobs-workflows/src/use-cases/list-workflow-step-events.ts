import { ok } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowStepEventStore } from "../ports";

export async function listWorkflowStepEvents(
  input: {
    ownerId: string;
    workflowRunId: string;
    limit?: number;
  },
  deps: {
    eventStore: WorkflowStepEventStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const events = await deps.eventStore.listForRun(input.ownerId, input.workflowRunId, input.limit ?? 100);
  return ok(200, { events, count: events.length }, meta);
}
