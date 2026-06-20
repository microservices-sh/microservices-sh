import type { AgentRunStore } from "../ports";
import type { AgentRun, AgentRunStatus, AgentRuntimeKind } from "../types";

const COLUMNS =
  "id, owner_id, workflow_run_id, step_run_id, agent_template_id, runtime_kind, status, input, output, error, external_run_id, capability_grant_id, resume_token_hash, created_at, updated_at, finished_at, expires_at";

function rowToRun(row: Record<string, unknown>): AgentRun {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    workflowRunId: String(row.workflow_run_id),
    stepRunId: String(row.step_run_id),
    agentTemplateId: String(row.agent_template_id),
    runtimeKind: String(row.runtime_kind) as AgentRuntimeKind,
    status: String(row.status) as AgentRunStatus,
    input: JSON.parse(String(row.input ?? "{}")) as Record<string, unknown>,
    output: row.output ? (JSON.parse(String(row.output)) as Record<string, unknown>) : null,
    error: row.error ? String(row.error) : null,
    externalRunId: row.external_run_id ? String(row.external_run_id) : null,
    capabilityGrantId: String(row.capability_grant_id),
    resumeTokenHash: String(row.resume_token_hash),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    expiresAt: String(row.expires_at)
  };
}

export function createD1AgentRunStore(db: D1Database): AgentRunStore {
  return {
    async insert(run) {
      await db
        .prepare(`INSERT INTO agent_runs (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          run.id,
          run.ownerId,
          run.workflowRunId,
          run.stepRunId,
          run.agentTemplateId,
          run.runtimeKind,
          run.status,
          JSON.stringify(run.input),
          run.output ? JSON.stringify(run.output) : null,
          run.error,
          run.externalRunId,
          run.capabilityGrantId,
          run.resumeTokenHash,
          run.createdAt,
          run.updatedAt,
          run.finishedAt,
          run.expiresAt
        )
        .run();
    },

    async getForOwner(ownerId, id) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM agent_runs WHERE owner_id = ? AND id = ?`)
        .bind(ownerId, id)
        .first<Record<string, unknown>>();
      return row ? rowToRun(row) : null;
    },

    async update(run) {
      await db
        .prepare(
          `UPDATE agent_runs
           SET status = ?, output = ?, error = ?, external_run_id = ?, updated_at = ?, finished_at = ?
           WHERE owner_id = ? AND id = ?`
        )
        .bind(
          run.status,
          run.output ? JSON.stringify(run.output) : null,
          run.error,
          run.externalRunId,
          run.updatedAt,
          run.finishedAt,
          run.ownerId,
          run.id
        )
        .run();
    },

    async listForWorkflow(ownerId, workflowRunId) {
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM agent_runs WHERE owner_id = ? AND workflow_run_id = ? ORDER BY created_at DESC`)
        .bind(ownerId, workflowRunId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToRun);
    }
  };
}
