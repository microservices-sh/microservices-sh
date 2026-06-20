import type { WorkflowStepEventStore } from "../ports";
import type { WorkflowStepEvent } from "../types";

function cloneEvent(event: WorkflowStepEvent): WorkflowStepEvent {
  return {
    ...event,
    payload: { ...event.payload }
  };
}

export function createMemoryWorkflowStepEventStore(): WorkflowStepEventStore {
  const events: WorkflowStepEvent[] = [];

  return {
    async append(event) {
      events.push(cloneEvent(event));
    },

    async listForRun(ownerId, workflowRunId, limit = 100) {
      return events
        .filter((event) => event.ownerId === ownerId && event.workflowRunId === workflowRunId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit)
        .map(cloneEvent);
    }
  };
}
