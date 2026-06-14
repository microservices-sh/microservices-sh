import type { DeliveryLogStore } from "../ports";
import type { DeliveryAttempt, DeliveryStatus } from "../types";

function rowToAttempt(row: Record<string, unknown>): DeliveryAttempt {
  return {
    id: String(row.id),
    endpointId: String(row.endpoint_id),
    eventName: String(row.event_name),
    status: String(row.status) as DeliveryStatus,
    statusCode: row.status_code === null || row.status_code === undefined ? null : Number(row.status_code),
    error: row.error ? String(row.error) : null,
    createdAt: String(row.created_at)
  };
}

export function createD1DeliveryLog(db: D1Database): DeliveryLogStore {
  return {
    async append(attempt) {
      await db
        .prepare(
          "INSERT INTO webhook_deliveries (id, endpoint_id, event_name, status, status_code, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          attempt.id,
          attempt.endpointId,
          attempt.eventName,
          attempt.status,
          attempt.statusCode,
          attempt.error,
          attempt.createdAt
        )
        .run();
    },

    async list(filter) {
      const clauses: string[] = [];
      const binds: unknown[] = [];
      if (filter.endpointId) {
        clauses.push("endpoint_id = ?");
        binds.push(filter.endpointId);
      }
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = filter.limit ?? 100;
      const result = await db
        .prepare(`SELECT * FROM webhook_deliveries ${where} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToAttempt);
    }
  };
}
