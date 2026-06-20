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

    async getForRunStep(workflowRunId, stepId) {
      for (const stepRun of stepRuns.values()) {
        if (stepRun.workflowRunId === workflowRunId && stepRun.stepId === stepId) {
          return cloneStepRun(stepRun);
        }
      }
      return null;
    },

    async update(stepRun) {
      if (!stepRuns.has(stepRun.id)) return;
      stepRuns.set(stepRun.id, cloneStepRun(stepRun));
    },

    async listForRun(workflowRunId) {
      return [...stepRuns.values()]
        .filter((stepRun) => stepRun.workflowRunId === workflowRunId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(cloneStepRun);
    }
  };
}
