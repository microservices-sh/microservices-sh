-- Jobs & Workflows owns three tables: the job queue, an append-only attempt log,
-- and recurring schedules.

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,            -- pending | running | succeeded | dead
  idempotency_key TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_at TEXT NOT NULL,            -- ISO; eligible-to-run time (now + delay/backoff)
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Enforce enqueue idempotency at the database, not just in app code: a duplicate
-- key cannot create a second job even under a concurrent race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency
  ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Drives the worker pull loop: pending jobs ordered by when they are due.
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);

-- Append-only attempt log. Rows are never updated or deleted.
CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,            -- succeeded | failed
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job_id);

-- Recurring schedules. next_run_at is advanced with catch-up semantics.
CREATE TABLE IF NOT EXISTS job_schedules (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  interval_ms INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_run_at TEXT,
  next_run_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_schedules_due ON job_schedules(next_run_at);
