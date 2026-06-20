import type { WorkflowRunFilter, WorkflowRunStore } from "../ports";
import type { WorkflowRun, WorkflowRunStatus, WorkflowStepDefinition } from "../types";

const COLUMNS =
  "id, owner_id, definition_id, definition_version, status, trigger, input, context, current_step_id, idempotency_key, step_definitions, created_at, updated_at, finished_at";

function rowToWorkflowRun(row: Record<string, unknown>): WorkflowRun {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    definitionId: String(row.definition_id),
    definitionVersion: Number(row.definition_version ?? 1),
    status: String(row.status) as WorkflowRunStatus,
    trigger: JSON.parse(String(row.trigger ?? "{}")) as Record<string, unknown>,
    input: JSON.parse(String(row.input ?? "{}")) as Record<string, unknown>,
    context: JSON.parse(String(row.context ?? "{}")) as Record<string, unknown>,
    currentStepId: row.current_step_id ? String(row.current_step_id) : null,
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    stepDefinitions: JSON.parse(String(row.step_definitions ?? "[]")) as WorkflowStepDefinition[],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null
  };
}

export function createD1WorkflowRunStore(db: D1Database): WorkflowRunStore {
  return {
    async insert(run) {
      await db
        .prepare(`INSERT INTO workflow_runs (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          run.id,
          run.ownerId,
          run.definitionId,
          run.definitionVersion,
          run.status,
          JSON.stringify(run.trigger),
          JSON.stringify(run.input),
          JSON.stringify(run.context),
          run.currentStepId,
          run.idempotencyKey,
          JSON.stringify(run.stepDefinitions),
          run.createdAt,
          run.updatedAt,
          run.finishedAt
        )
        .run();
    },

    async get(id) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_runs WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToWorkflowRun(row) : null;
    },

    async getForOwner(ownerId, id) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_runs WHERE owner_id = ? AND id = ?`)
        .bind(ownerId, id)
        .first<Record<string, unknown>>();
      return row ? rowToWorkflowRun(row) : null;
    },

    async findByIdempotencyKey(ownerId, key) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_runs WHERE owner_id = ? AND idempotency_key = ?`)
        .bind(ownerId, key)
        .first<Record<string, unknown>>();
      return row ? rowToWorkflowRun(row) : null;
    },

    async update(run) {
      await db
        .prepare(
          `UPDATE workflow_runs
           SET status = ?, context = ?, current_step_id = ?, updated_at = ?, finished_at = ?
           WHERE id = ? AND owner_id = ?`
        )
        .bind(run.status, JSON.stringify(run.context), run.currentStepId, run.updatedAt, run.finishedAt, run.id, run.ownerId)
        .run();
    },

    async list(filter: WorkflowRunFilter) {
      const clauses: string[] = [];
      const binds: unknown[] = [];
      if (filter.ownerId) {
        clauses.push("owner_id = ?");
        binds.push(filter.ownerId);
      }
      if (filter.definitionId) {
        clauses.push("definition_id = ?");
        binds.push(filter.definitionId);
      }
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = filter.limit ?? 100;
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_runs ${where} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToWorkflowRun);
    }
  };
}
