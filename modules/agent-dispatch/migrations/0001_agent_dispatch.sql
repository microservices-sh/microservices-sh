CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  step_run_id TEXT NOT NULL,
  agent_template_id TEXT NOT NULL,
  runtime_kind TEXT NOT NULL,
  status TEXT NOT NULL,            -- queued | provisioning | running | waiting | succeeded | failed | canceled | timed_out
  input TEXT NOT NULL,
  output TEXT,
  error TEXT,
  external_run_id TEXT,
  capability_grant_id TEXT NOT NULL,
  resume_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_workflow
  ON agent_runs(owner_id, workflow_run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status
  ON agent_runs(owner_id, status, updated_at);

CREATE TABLE IF NOT EXISTS capability_grants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  step_run_id TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  allowed_tools TEXT NOT NULL,
  allowed_resources TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_grants_agent_run
  ON capability_grants(owner_id, agent_run_id);

CREATE INDEX IF NOT EXISTS idx_capability_grants_expiry
  ON capability_grants(owner_id, expires_at);
