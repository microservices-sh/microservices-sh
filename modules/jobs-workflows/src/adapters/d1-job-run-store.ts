import type { JobRunStore } from "../ports";
import type { JobRun } from "../types";

function rowToRun(row: Record<string, unknown>): JobRun {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    attempt: Number(row.attempt ?? 0),
    status: String(row.status) as JobRun["status"],
    error: row.error ? String(row.error) : null,
    startedAt: String(row.started_at),
    finishedAt: String(row.finished_at)
  };
}

export function createD1JobRunStore(db: D1Database): JobRunStore {
  return {
    async append(run) {
      await db
        .prepare(
          "INSERT INTO job_runs (id, job_id, attempt, status, error, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(run.id, run.jobId, run.attempt, run.status, run.error, run.startedAt, run.finishedAt)
        .run();
    },

    async listForJob(jobId) {
      const result = await db
        .prepare(
          "SELECT id, job_id, attempt, status, error, started_at, finished_at FROM job_runs WHERE job_id = ? ORDER BY attempt ASC"
        )
        .bind(jobId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToRun);
    }
  };
}
