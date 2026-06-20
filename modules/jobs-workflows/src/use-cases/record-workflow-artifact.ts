import { err, ok } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowArtifactStore } from "../ports";
import { recordWorkflowArtifactInputSchema } from "../schemas";
import type { DomainEvent, WorkflowArtifact } from "../types";

export async function recordWorkflowArtifact(
  input: unknown,
  deps: {
    artifactStore: WorkflowArtifactStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const parsed = recordWorkflowArtifactInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "jobs-workflows.INVALID_WORKFLOW_ARTIFACT", message: "Workflow artifact input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const artifact: WorkflowArtifact = {
    id: "wfa_" + crypto.randomUUID().slice(0, 16),
    ownerId: parsed.data.ownerId,
    workflowRunId: parsed.data.workflowRunId,
    stepRunId: parsed.data.stepRunId ?? null,
    kind: parsed.data.kind,
    name: parsed.data.name,
    uri: parsed.data.uri ?? null,
    content: parsed.data.content ?? null,
    metadata: parsed.data.metadata,
    createdAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };

  await deps.artifactStore.insert(artifact);

  const event: DomainEvent = {
    name: "workflow.artifact.recorded",
    correlationId: meta.correlationId,
    payload: {
      id: artifact.id,
      ownerId: artifact.ownerId,
      workflowRunId: artifact.workflowRunId,
      stepRunId: artifact.stepRunId,
      kind: artifact.kind,
      name: artifact.name
    }
  };

  return ok(201, { artifact, event }, meta);
}
