import type { WorkflowStepEventStore } from "../ports";
import type { WorkflowStepEvent, WorkflowStepEventName } from "../types";

const COLUMNS = "id, owner_id, workflow_run_id, step_run_id, step_id, name, payload, created_at";

function rowToEvent(row: Record<string, unknown>): WorkflowStepEvent {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    workflowRunId: String(row.workflow_run_id),
    stepRunId: row.step_run_id ? String(row.step_run_id) : null,
    stepId: row.step_id ? String(row.step_id) : null,
    name: String(row.name) as WorkflowStepEventName,
    payload: JSON.parse(String(row.payload ?? "{}")) as Record<string, unknown>,
    createdAt: String(row.created_at)
  };
}

export function createD1WorkflowStepEventStore(db: D1Database): WorkflowStepEventStore {
  return {
    async append(event) {
      await db
        .prepare(`INSERT INTO workflow_step_events (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          event.id,
          event.ownerId,
          event.workflowRunId,
          event.stepRunId,
          event.stepId,
          event.name,
          JSON.stringify(event.payload),
          event.createdAt
        )
        .run();
    },

    async listForRun(ownerId, workflowRunId, limit = 100) {
      const result = await db
        .prepare(
          `SELECT ${COLUMNS} FROM workflow_step_events
           WHERE owner_id = ? AND workflow_run_id = ?
           ORDER BY created_at ASC LIMIT ?`
        )
        .bind(ownerId, workflowRunId, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToEvent);
    }
  };
}
