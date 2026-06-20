import type { AgentRunStore } from "../ports";
import type { AgentRun } from "../types";

function cloneRun(run: AgentRun): AgentRun {
  return {
    ...run,
    input: { ...run.input },
    output: run.output ? { ...run.output } : null
  };
}

export function createMemoryAgentRunStore(): AgentRunStore {
  const runs = new Map<string, AgentRun>();

  return {
    async insert(run) {
      runs.set(run.id, cloneRun(run));
    },

    async getForOwner(ownerId, id) {
      const run = runs.get(id);
      return run && run.ownerId === ownerId ? cloneRun(run) : null;
    },

    async update(run) {
      const existing = runs.get(run.id);
      if (!existing || existing.ownerId !== run.ownerId) return;
      runs.set(run.id, cloneRun(run));
    },

    async listForWorkflow(ownerId, workflowRunId) {
      return [...runs.values()]
        .filter((run) => run.ownerId === ownerId && run.workflowRunId === workflowRunId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(cloneRun);
    }
  };
}
