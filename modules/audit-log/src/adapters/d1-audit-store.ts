import type { AuditEventStore } from "../ports";
import type { AuditEvent } from "../types";

function rowToEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id: String(row.id),
    eventName: String(row.event_name),
    actorId: row.actor_id ? String(row.actor_id) : null,
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    source: row.source ? String(row.source) : null,
    payload: JSON.parse(String(row.payload ?? "{}")) as Record<string, unknown>,
    createdAt: String(row.created_at)
  };
}

export function createD1AuditEventStore(db: D1Database): AuditEventStore {
  return {
    async append(event) {
      await db
        .prepare(
          "INSERT INTO audit_events (id, event_name, actor_id, entity_type, entity_id, source, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          event.id,
          event.eventName,
          event.actorId,
          event.entityType,
          event.entityId,
          event.source,
          JSON.stringify(event.payload),
          event.createdAt
        )
        .run();
    },

    async list(filter) {
      const clauses = [];
      const binds = [];
      if (filter.entityType) {
        clauses.push("entity_type = ?");
        binds.push(filter.entityType);
      }
      if (filter.entityId) {
        clauses.push("entity_id = ?");
        binds.push(filter.entityId);
      }
      if (filter.eventName) {
        clauses.push("event_name = ?");
        binds.push(filter.eventName);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = filter.limit ?? 100;
      const result = await db
        .prepare(
          `SELECT id, event_name, actor_id, entity_type, entity_id, source, payload, created_at FROM audit_events ${where} ORDER BY created_at DESC LIMIT ?`
        )
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToEvent);
    }
  };
}
