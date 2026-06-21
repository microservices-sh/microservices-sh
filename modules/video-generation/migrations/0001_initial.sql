CREATE TABLE IF NOT EXISTS video_generation_jobs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  owner_id TEXT,
  provider TEXT NOT NULL,
  provider_task_id TEXT,
  model TEXT,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  duration_seconds INTEGER NOT NULL,
  resolution TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  seed INTEGER,
  reference_assets_json TEXT NOT NULL DEFAULT '[]',
  progress INTEGER,
  error_message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  cancelled_at TEXT,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, provider_task_id)
);

CREATE TABLE IF NOT EXISTS video_generation_outputs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  storage_key TEXT,
  public_url TEXT,
  provider_url TEXT,
  mime_type TEXT NOT NULL DEFAULT 'video/mp4',
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, job_id) REFERENCES video_generation_jobs (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_owner ON video_generation_jobs (tenant_id, owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status ON video_generation_jobs (tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_provider_task ON video_generation_jobs (tenant_id, provider_task_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_outputs_job ON video_generation_outputs (tenant_id, job_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_generation_outputs_provider_url ON video_generation_outputs (tenant_id, job_id, provider_url);
CREATE INDEX IF NOT EXISTS idx_video_generation_outputs_expires_at ON video_generation_outputs (tenant_id, expires_at);
