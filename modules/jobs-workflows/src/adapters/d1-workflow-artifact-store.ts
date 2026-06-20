import type { WorkflowArtifactStore } from "../ports";
import type { WorkflowArtifact, WorkflowArtifactKind } from "../types";

const COLUMNS = "id, owner_id, workflow_run_id, step_run_id, kind, name, uri, content, metadata, created_at";

function rowToArtifact(row: Record<string, unknown>): WorkflowArtifact {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    workflowRunId: String(row.workflow_run_id),
    stepRunId: row.step_run_id ? String(row.step_run_id) : null,
    kind: String(row.kind) as WorkflowArtifactKind,
    name: String(row.name),
    uri: row.uri ? String(row.uri) : null,
    content: row.content ? (JSON.parse(String(row.content)) as Record<string, unknown> | string) : null,
    metadata: JSON.parse(String(row.metadata ?? "{}")) as Record<string, unknown>,
    createdAt: String(row.created_at)
  };
}

export function createD1WorkflowArtifactStore(db: D1Database): WorkflowArtifactStore {
  return {
    async insert(artifact) {
      await db
        .prepare(`INSERT INTO workflow_artifacts (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          artifact.id,
          artifact.ownerId,
          artifact.workflowRunId,
          artifact.stepRunId,
          artifact.kind,
          artifact.name,
          artifact.uri,
          artifact.content === null ? null : JSON.stringify(artifact.content),
          JSON.stringify(artifact.metadata),
          artifact.createdAt
        )
        .run();
    },

    async listForRun(ownerId, workflowRunId) {
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM workflow_artifacts WHERE owner_id = ? AND workflow_run_id = ? ORDER BY created_at ASC`)
        .bind(ownerId, workflowRunId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToArtifact);
    },

    async listForStep(ownerId, workflowRunId, stepRunId) {
      const result = await db
        .prepare(
          `SELECT ${COLUMNS} FROM workflow_artifacts
           WHERE owner_id = ? AND workflow_run_id = ? AND step_run_id = ?
           ORDER BY created_at ASC`
        )
        .bind(ownerId, workflowRunId, stepRunId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToArtifact);
    }
  };
}
