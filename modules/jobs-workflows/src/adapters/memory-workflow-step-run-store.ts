import type { WorkflowStepRunStore } from "../ports";
import type { WorkflowStepRun } from "../types";

function cloneStepRun(stepRun: WorkflowStepRun): WorkflowStepRun {
  return {
    ...stepRun,
    input: { ...stepRun.input },
    output: stepRun.output ? { ...stepRun.output } : null
  };
}

export function createMemoryWorkflowStepRunStore(): WorkflowStepRunStore {
  const stepRuns = new Map<string, WorkflowStepRun>();

  return {
    async insert(stepRun) {
      stepRuns.set(stepRun.id, cloneStepRun(stepRun));
    },

    async get(id) {
      const stepRun = stepRuns.get(id);
      return stepRun ? cloneStepRun(stepRun) : null;
    },

    async getForOwnerRunStep(ownerId, workflowRunId, stepId) {
      for (const stepRun of stepRuns.values()) {
        if (stepRun.ownerId === ownerId && stepRun.workflowRunId === workflowRunId && stepRun.stepId === stepId) {
          return cloneStepRun(stepRun);
        }
      }
      return null;
    },

    async claimPending(ownerId, workflowRunId, stepId, nowIso) {
      for (const stepRun of stepRuns.values()) {
        if (
          stepRun.ownerId === ownerId &&
          stepRun.workflowRunId === workflowRunId &&
          stepRun.stepId === stepId &&
          stepRun.status === "pending" &&
          stepRun.runAt <= nowIso
        ) {
          const claimed: WorkflowStepRun = {
            ...stepRun,
            status: "running",
            attempt: stepRun.attempt + 1,
            startedAt: nowIso,
            updatedAt: nowIso
          };
          stepRuns.set(stepRun.id, cloneStepRun(claimed));
          return cloneStepRun(claimed);
        }
      }
      return null;
    },

    async update(stepRun) {
      const existing = stepRuns.get(stepRun.id);
      if (!existing || existing.ownerId !== stepRun.ownerId) return;
      stepRuns.set(stepRun.id, cloneStepRun(stepRun));
    },

    async listForRun(ownerId, workflowRunId) {
      return [...stepRuns.values()]
        .filter((stepRun) => stepRun.ownerId === ownerId && stepRun.workflowRunId === workflowRunId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(cloneStepRun);
    }
  };
}
