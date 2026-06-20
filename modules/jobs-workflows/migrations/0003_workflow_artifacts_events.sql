-- Append-only workflow observability: durable artifacts and step events.

CREATE TABLE IF NOT EXISTS workflow_artifacts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  step_run_id TEXT,
  kind TEXT NOT NULL,              -- json | text | file | url | diff | log | image | other
  name TEXT NOT NULL,
  uri TEXT,
  content TEXT,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_run
  ON workflow_artifacts(owner_id, workflow_run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_step
  ON workflow_artifacts(owner_id, workflow_run_id, step_run_id, created_at);

CREATE TABLE IF NOT EXISTS workflow_step_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  step_run_id TEXT,
  step_id TEXT,
  name TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_events_run
  ON workflow_step_events(owner_id, workflow_run_id, created_at);
