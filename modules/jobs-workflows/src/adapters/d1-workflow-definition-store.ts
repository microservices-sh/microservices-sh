import type { WorkflowDefinitionStore } from "../ports";
import type { WorkflowDefinition, WorkflowDefinitionStatus, WorkflowStepDefinition } from "../types";

const COLUMNS = "id, owner_id, name, version, status, trigger, steps, created_at, updated_at";

function rowToWorkflowDefinition(row: Record<string, unknown>): WorkflowDefinition {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    version: Number(row.version ?? 1),
    status: String(row.status) as WorkflowDefinitionStatus,
    trigger: row.trigger ? (JSON.parse(String(row.trigger)) as Record<string, unknown>) : null,
    steps: JSON.parse(String(row.steps ?? "[]")) as WorkflowStepDefinition[],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1WorkflowDefinitionStore(db: D1Database): WorkflowDefinitionStore {
  return {
    async insert(definition) {
      await db
        .prepare(`INSERT INTO workflow_definitions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          definition.id,
          definition.ownerId,
          definition.name,
          definition.version,
          definition.status,
          definition.trigger ? JSON.stringify(definition.trigger) : null,
          JSON.stringify(definition.steps),
          definition.createdAt,
          definition.updatedAt
        )
        .run();
    },

    async get(id) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_definitions WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToWorkflowDefinition(row) : null;
    }
  };
}
