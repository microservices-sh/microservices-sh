-- Generic workflow orchestration. The runner snapshots step definitions into
-- workflow_runs so active runs are deterministic even when definitions change.

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,            -- draft | active | archived
  trigger TEXT,
  steps TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_owner
  ON workflow_definitions(owner_id, status);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  definition_id TEXT NOT NULL,
  definition_version INTEGER NOT NULL,
  status TEXT NOT NULL,            -- queued | running | waiting | succeeded | failed | canceled
  trigger TEXT NOT NULL,
  input TEXT NOT NULL,
  context TEXT NOT NULL,
  current_step_id TEXT,
  idempotency_key TEXT,
  step_definitions TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_idempotency
  ON workflow_runs(owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_owner_status
  ON workflow_runs(owner_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_definition
  ON workflow_runs(definition_id, created_at);

CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  kind TEXT NOT NULL,              -- tool | agent | approval | condition | wait | emit
  status TEXT NOT NULL,            -- pending | running | waiting | succeeded | failed | dead | skipped
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  input TEXT NOT NULL,
  output TEXT,
  error TEXT,
  run_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_step_runs_run_step
  ON workflow_step_runs(workflow_run_id, step_id);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_owner_status
  ON workflow_step_runs(owner_id, status, run_at);
