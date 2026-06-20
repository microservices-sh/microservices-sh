import type { WorkflowRunFilter, WorkflowRunStore } from "../ports";
import type { WorkflowRun } from "../types";

function cloneRun(run: WorkflowRun): WorkflowRun {
  return {
    ...run,
    trigger: { ...run.trigger },
    input: { ...run.input },
    context: { ...run.context },
    stepDefinitions: run.stepDefinitions.map((step) => ({ ...step, input: { ...step.input } }))
  };
}

export function createMemoryWorkflowRunStore(): WorkflowRunStore {
  const runs = new Map<string, WorkflowRun>();

  return {
    async insert(run) {
      if (run.idempotencyKey) {
        for (const existing of runs.values()) {
          if (existing.ownerId === run.ownerId && existing.idempotencyKey === run.idempotencyKey) {
            throw new Error("UNIQUE constraint failed: workflow_runs.owner_id, workflow_runs.idempotency_key");
          }
        }
      }
      runs.set(run.id, cloneRun(run));
    },

    async get(id) {
      const run = runs.get(id);
      return run ? cloneRun(run) : null;
    },

    async findByIdempotencyKey(ownerId, key) {
      for (const run of runs.values()) {
        if (run.ownerId === ownerId && run.idempotencyKey === key) return cloneRun(run);
      }
      return null;
    },

    async update(run) {
      if (!runs.has(run.id)) return;
      runs.set(run.id, cloneRun(run));
    },

    async list(filter: WorkflowRunFilter) {
      let rows = [...runs.values()];
      if (filter.ownerId) rows = rows.filter((run) => run.ownerId === filter.ownerId);
      if (filter.definitionId) rows = rows.filter((run) => run.definitionId === filter.definitionId);
      if (filter.status) rows = rows.filter((run) => run.status === filter.status);
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.slice(0, filter.limit ?? 100).map(cloneRun);
    }
  };
}
