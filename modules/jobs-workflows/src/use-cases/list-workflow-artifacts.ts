import { ok } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowArtifactStore } from "../ports";

export async function listWorkflowArtifacts(
  input: {
    ownerId: string;
    workflowRunId: string;
    stepRunId?: string | null;
  },
  deps: {
    artifactStore: WorkflowArtifactStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const artifacts = input.stepRunId
    ? await deps.artifactStore.listForStep(input.ownerId, input.workflowRunId, input.stepRunId)
    : await deps.artifactStore.listForRun(input.ownerId, input.workflowRunId);

  return ok(200, { artifacts, count: artifacts.length }, meta);
}
