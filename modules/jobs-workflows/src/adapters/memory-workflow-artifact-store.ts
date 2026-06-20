import type { WorkflowArtifactStore } from "../ports";
import type { WorkflowArtifact } from "../types";

function cloneContent(content: WorkflowArtifact["content"]): WorkflowArtifact["content"] {
  if (!content || typeof content !== "object") return content;
  return { ...content };
}

function cloneArtifact(artifact: WorkflowArtifact): WorkflowArtifact {
  return {
    ...artifact,
    content: cloneContent(artifact.content),
    metadata: { ...artifact.metadata }
  };
}

export function createMemoryWorkflowArtifactStore(): WorkflowArtifactStore {
  const artifacts = new Map<string, WorkflowArtifact>();

  return {
    async insert(artifact) {
      artifacts.set(artifact.id, cloneArtifact(artifact));
    },

    async listForRun(ownerId, workflowRunId) {
      return [...artifacts.values()]
        .filter((artifact) => artifact.ownerId === ownerId && artifact.workflowRunId === workflowRunId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(cloneArtifact);
    },

    async listForStep(ownerId, workflowRunId, stepRunId) {
      return [...artifacts.values()]
        .filter(
          (artifact) =>
            artifact.ownerId === ownerId &&
            artifact.workflowRunId === workflowRunId &&
            artifact.stepRunId === stepRunId
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(cloneArtifact);
    }
  };
}
