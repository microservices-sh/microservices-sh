import type { ScheduleStore } from "../ports";
import type { JobSchedule } from "../types";

function rowToSchedule(row: Record<string, unknown>): JobSchedule {
  return {
    id: String(row.id),
    type: String(row.type),
    payload: JSON.parse(String(row.payload ?? "{}")) as Record<string, unknown>,
    intervalMs: Number(row.interval_ms ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    nextRunAt: String(row.next_run_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

const COLUMNS = "id, type, payload, interval_ms, max_attempts, last_run_at, next_run_at, created_at, updated_at";

export function createD1ScheduleStore(db: D1Database): ScheduleStore {
  return {
    async upsert(schedule) {
      await db
        .prepare(
          `INSERT INTO job_schedules (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             type = excluded.type,
             payload = excluded.payload,
             interval_ms = excluded.interval_ms,
             max_attempts = excluded.max_attempts,
             last_run_at = excluded.last_run_at,
             next_run_at = excluded.next_run_at,
             updated_at = excluded.updated_at`
        )
        .bind(
          schedule.id,
          schedule.type,
          JSON.stringify(schedule.payload),
          schedule.intervalMs,
          schedule.maxAttempts,
          schedule.lastRunAt,
          schedule.nextRunAt,
          schedule.createdAt,
          schedule.updatedAt
        )
        .run();
    },

    async get(id) {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM job_schedules WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToSchedule(row) : null;
    },

    async listDue(nowIso) {
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM job_schedules WHERE next_run_at <= ? ORDER BY next_run_at ASC`)
        .bind(nowIso)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToSchedule);
    },

    async list() {
      const result = await db
        .prepare(`SELECT ${COLUMNS} FROM job_schedules ORDER BY created_at DESC`)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToSchedule);
    }
  };
}
