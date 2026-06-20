import type { WorkflowStepRunStore } from "../ports";
import type { WorkflowStepKind, WorkflowStepRun, WorkflowStepRunStatus } from "../types";

const COLUMNS =
  "id, owner_id, workflow_run_id, step_id, kind, status, attempt, max_attempts, input, output, error, run_at, started_at, finished_at, created_at, updated_at";

function rowToWorkflowStepRun(row: Record<string, unknown>): WorkflowStepRun {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    workflowRunId: String(row.workflow_run_id),
    stepId: String(row.step_id),
    kind: String(row.kind) as WorkflowStepKind,
    status: String(row.status) as WorkflowStepRunStatus,
    attempt: Number(row.attempt ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    input: JSON.parse(String(row.input ?? "{}")) as Record<string, unknown>,
    output: row.output ? (JSON.parse(String(row.output)) as Record<string, unknown>) : null,
    error: row.error ? String(row.error) : null,
    runAt: String(row.run_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1WorkflowStepRunStore(db: D1Database): WorkflowStepRunStore {
  return {
    async insert(stepRun) {
      await db
        .prepare(`INSERT INTO workflow_step_runs (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          stepRun.id,
          stepRun.ownerId,
          stepRun.workflowRunId,
          stepRun.stepId,
          stepRun.kind,
          stepRun.status,
          stepRun.attempt,
          stepRun.maxAttempts,
          JSON.stringify(stepRun.input),
          stepRun.output ? JSON.stringify(stepRun.output) : null,
          stepRun.error,
          stepRun.runAt,
          stepRun.startedAt,
          stepRun.finishedAt,
          stepRun.createdAt,
          stepRun.updatedAt
        )
        .run();
    },

    async get(id) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_step_runs WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToWorkflowStepRun(row) : null;
    },

    async getForRunStep(workflowRunId, stepId) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_step_runs WHERE workflow_run_id = ? AND step_id = ?`)
        .bind(workflowRunId, stepId)
        .first<Record<string, unknown>>();
      return row ? rowToWorkflowStepRun(row) : null;
    },

    async update(stepRun) {
      await db
        .prepare(
          `UPDATE workflow_step_runs
           SET status = ?, attempt = ?, input = ?, output = ?, error = ?, run_at = ?, started_at = ?, finished_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          stepRun.status,
          stepRun.attempt,
          JSON.stringify(stepRun.input),
          stepRun.output ? JSON.stringify(stepRun.output) : null,
          stepRun.error,
          stepRun.runAt,
          stepRun.startedAt,
          stepRun.finishedAt,
          stepRun.updatedAt,
          stepRun.id
        )
        .run();
    },

    async listForRun(workflowRunId) {
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_step_runs WHERE workflow_run_id = ? ORDER BY created_at ASC`)
        .bind(workflowRunId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToWorkflowStepRun);
    }
  };
}
