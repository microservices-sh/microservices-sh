import type { JobStore } from "../ports";
import type { Job, JobStatus } from "../types";

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    type: String(row.type),
    payload: JSON.parse(String(row.payload ?? "{}")) as Record<string, unknown>,
    status: String(row.status) as JobStatus,
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    runAt: String(row.run_at),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

const COLUMNS =
  "id, type, payload, status, idempotency_key, attempts, max_attempts, run_at, last_error, created_at, updated_at";

export function createD1JobStore(db: D1Database): JobStore {
  return {
    async insert(job) {
      await db
        .prepare(
          `INSERT INTO jobs (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          job.id,
          job.type,
          JSON.stringify(job.payload),
          job.status,
          job.idempotencyKey,
          job.attempts,
          job.maxAttempts,
          job.runAt,
          job.lastError,
          job.createdAt,
          job.updatedAt
        )
        .run();
    },

    async get(id) {
      const row = await db.prepare(`SELECT ${COLUMNS} FROM jobs WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToJob(row) : null;
    },

    async findByIdempotencyKey(key) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM jobs WHERE idempotency_key = ?`)
        .bind(key)
        .first<Record<string, unknown>>();
      return row ? rowToJob(row) : null;
    },

    async update(job) {
      await db
        .prepare(
          `UPDATE jobs SET status = ?, attempts = ?, run_at = ?, last_error = ?, updated_at = ? WHERE id = ?`
        )
        .bind(job.status, job.attempts, job.runAt, job.lastError, job.updatedAt, job.id)
        .run();
    },

    async listDue(nowIso, limit) {
      const result = await db
        .prepare(
          `SELECT ${COLUMNS} FROM jobs WHERE status = 'pending' AND run_at <= ? ORDER BY run_at ASC LIMIT ?`
        )
        .bind(nowIso, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToJob);
    },

    async list(filter) {
      const clauses: string[] = [];
      const binds: unknown[] = [];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter.type) {
        clauses.push("type = ?");
        binds.push(filter.type);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = filter.limit ?? 100;
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM jobs ${where} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToJob);
    }
  };
}
