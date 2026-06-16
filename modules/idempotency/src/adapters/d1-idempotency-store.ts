import type { IdempotencyStore } from "../ports";
import type { IdempotencyRecord, IdempotencyStatus } from "../types";

const COLUMNS =
  "id, scope, key, request_hash, status, response_json, error_json, metadata_json, status_code, locked_until, expires_at, created_at, updated_at, completed_at";

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  const parsed = JSON.parse(String(value)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

function jsonOrNull(value: Record<string, unknown> | null): string | null {
  if (value === null) return null;
  return JSON.stringify(value);
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  return Number(value);
}

function rowToRecord(row: Record<string, unknown>): IdempotencyRecord {
  return {
    id: String(row.id),
    scope: String(row.scope),
    key: String(row.key),
    requestHash: nullableString(row.request_hash),
    status: String(row.status) as IdempotencyStatus,
    response: parseJsonObject(row.response_json),
    error: parseJsonObject(row.error_json),
    metadata: parseJsonObject(row.metadata_json) ?? {},
    statusCode: nullableNumber(row.status_code),
    lockedUntil: nullableString(row.locked_until),
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: nullableString(row.completed_at)
  };
}

function bindRecord(stmt: D1PreparedStatement, record: IdempotencyRecord) {
  return stmt.bind(
    record.id,
    record.scope,
    record.key,
    record.requestHash,
    record.status,
    jsonOrNull(record.response),
    jsonOrNull(record.error),
    JSON.stringify(record.metadata),
    record.statusCode,
    record.lockedUntil,
    record.expiresAt,
    record.createdAt,
    record.updatedAt,
    record.completedAt
  );
}

export function createD1IdempotencyStore(db: D1Database): IdempotencyStore {
  return {
    async insert(record) {
      await bindRecord(
        db.prepare(`INSERT INTO idempotency_records (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        record
      ).run();
    },

    async get(scope, key) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM idempotency_records WHERE scope = ? AND key = ?`)
        .bind(scope, key)
        .first<Record<string, unknown>>();
      return row ? rowToRecord(row) : null;
    },

    async update(record) {
      await db
        .prepare(
          `UPDATE idempotency_records
             SET request_hash = ?, status = ?, response_json = ?, error_json = ?, metadata_json = ?,
                 status_code = ?, locked_until = ?, expires_at = ?, updated_at = ?, completed_at = ?
           WHERE id = ?`
        )
        .bind(
          record.requestHash,
          record.status,
          jsonOrNull(record.response),
          jsonOrNull(record.error),
          JSON.stringify(record.metadata),
          record.statusCode,
          record.lockedUntil,
          record.expiresAt,
          record.updatedAt,
          record.completedAt,
          record.id
        )
        .run();
    },

    async replace(record, previousUpdatedAt) {
      const result = await db
        .prepare(
          `UPDATE idempotency_records
             SET id = ?, request_hash = ?, status = ?, response_json = ?, error_json = ?, metadata_json = ?,
                 status_code = ?, locked_until = ?, expires_at = ?, created_at = ?, updated_at = ?, completed_at = ?
           WHERE scope = ? AND key = ? AND updated_at = ?`
        )
        .bind(
          record.id,
          record.requestHash,
          record.status,
          jsonOrNull(record.response),
          jsonOrNull(record.error),
          JSON.stringify(record.metadata),
          record.statusCode,
          record.lockedUntil,
          record.expiresAt,
          record.createdAt,
          record.updatedAt,
          record.completedAt,
          record.scope,
          record.key,
          previousUpdatedAt
        )
        .run();
      return (result.meta?.changes ?? 0) > 0;
    },

    async deleteExpired(beforeIso, limit) {
      const rows = await db
        .prepare("SELECT id FROM idempotency_records WHERE expires_at <= ? ORDER BY expires_at ASC LIMIT ?")
        .bind(beforeIso, limit)
        .all<{ id: string }>();
      const ids = (rows.results ?? []).map((row) => row.id);
      if (ids.length === 0) return 0;
      const placeholders = ids.map(() => "?").join(", ");
      const result = await db.prepare(`DELETE FROM idempotency_records WHERE id IN (${placeholders})`).bind(...ids).run();
      return result.meta?.changes ?? ids.length;
    },

    async list(filter) {
      const clauses: string[] = [];
      const binds: unknown[] = [];
      if (filter.scope) {
        clauses.push("scope = ?");
        binds.push(filter.scope);
      }
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter.expiredBefore) {
        clauses.push("expires_at <= ?");
        binds.push(filter.expiredBefore);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = filter.limit ?? 100;
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM idempotency_records ${where} ORDER BY updated_at DESC LIMIT ?`)
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToRecord);
    }
  };
}
