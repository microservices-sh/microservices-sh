import type { CapabilityGrantStore } from "../ports";
import type { CapabilityGrant } from "../types";

const COLUMNS =
  "id, owner_id, workflow_run_id, step_run_id, agent_run_id, allowed_tools, allowed_resources, expires_at, created_at, revoked_at";

function rowToGrant(row: Record<string, unknown>): CapabilityGrant {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    workflowRunId: String(row.workflow_run_id),
    stepRunId: String(row.step_run_id),
    agentRunId: String(row.agent_run_id),
    allowedTools: JSON.parse(String(row.allowed_tools ?? "[]")) as string[],
    allowedResources: JSON.parse(String(row.allowed_resources ?? "[]")) as string[],
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null
  };
}

export function createD1CapabilityGrantStore(db: D1Database): CapabilityGrantStore {
  return {
    async insert(grant) {
      await db
        .prepare(`INSERT INTO capability_grants (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          grant.id,
          grant.ownerId,
          grant.workflowRunId,
          grant.stepRunId,
          grant.agentRunId,
          JSON.stringify(grant.allowedTools),
          JSON.stringify(grant.allowedResources),
          grant.expiresAt,
          grant.createdAt,
          grant.revokedAt
        )
        .run();
    },

    async getForAgentRun(ownerId, agentRunId) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM capability_grants WHERE owner_id = ? AND agent_run_id = ?`)
        .bind(ownerId, agentRunId)
        .first<Record<string, unknown>>();
      return row ? rowToGrant(row) : null;
    },

    async revoke(ownerId, id, revokedAt) {
      await db
        .prepare(`UPDATE capability_grants SET revoked_at = ? WHERE owner_id = ? AND id = ?`)
        .bind(revokedAt, ownerId, id)
        .run();
    }
  };
}
