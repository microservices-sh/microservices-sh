import type { ApiKeyStore } from "../ports";
import type { ApiKeyRecord, DomainEvent } from "../types";

function rowToRecord(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    hash: String(row.hash),
    workspace: String(row.workspace),
    project: String(row.project),
    subject: String(row.subject),
    scopes: JSON.parse(String(row.scopes)) as string[],
    status: String(row.status) === "revoked" ? "revoked" : "active",
    createdAt: String(row.created_at)
  };
}

export function createD1ApiKeyStore(db: D1Database): ApiKeyStore {
  return {
    async getByHash(hash) {
      const row = await db
        .prepare("SELECT id, hash, workspace, project, subject, scopes, status, created_at FROM api_keys WHERE hash = ?")
        .bind(hash)
        .first<Record<string, unknown>>();
      return row ? rowToRecord(row) : null;
    },

    async putApiKey(record) {
      await db
        .prepare(
          "INSERT INTO api_keys (id, hash, workspace, project, subject, scopes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          record.id,
          record.hash,
          record.workspace,
          record.project,
          record.subject,
          JSON.stringify(record.scopes),
          record.status,
          record.createdAt
        )
        .run();
    },

    async revokeApiKey(id) {
      await db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?").bind(id).run();
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(
          "evt_" + crypto.randomUUID().slice(0, 12),
          event.eventName,
          event.entityType,
          event.entityId,
          JSON.stringify(event.payload),
          new Date().toISOString()
        )
        .run();
    }
  };
}
