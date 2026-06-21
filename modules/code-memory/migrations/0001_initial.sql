CREATE TABLE IF NOT EXISTS code_memory_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_user_id TEXT,
  provider TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_visibility TEXT NOT NULL DEFAULT 'unknown',
  default_branch TEXT,
  allowed_paths_json TEXT NOT NULL DEFAULT '[]',
  installation_id TEXT,
  scan_status TEXT NOT NULL DEFAULT 'not_scanned',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_memory_sources_tenant_created
  ON code_memory_sources (tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_code_memory_sources_tenant_repo_paths
  ON code_memory_sources (tenant_id, repo_url, allowed_paths_json);

CREATE TABLE IF NOT EXISTS code_memory_source_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  ref TEXT NOT NULL,
  commit_sha TEXT,
  tree_checksum TEXT,
  scan_status TEXT NOT NULL DEFAULT 'pending',
  scan_summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES code_memory_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_code_memory_versions_source_created
  ON code_memory_source_versions (tenant_id, source_id, created_at DESC);

CREATE TABLE IF NOT EXISTS code_memory_capsules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version_id TEXT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  reuse_mode TEXT NOT NULL DEFAULT 'adapt',
  source_path TEXT,
  source_files_json TEXT NOT NULL DEFAULT '[]',
  test_files_json TEXT NOT NULL DEFAULT '[]',
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  required_env_json TEXT NOT NULL DEFAULT '[]',
  inputs_json TEXT NOT NULL DEFAULT '[]',
  outputs_json TEXT NOT NULL DEFAULT '[]',
  usage_notes TEXT,
  constraints_json TEXT NOT NULL DEFAULT '[]',
  do_not_use_for_json TEXT NOT NULL DEFAULT '[]',
  checksum TEXT,
  approval_status TEXT NOT NULL DEFAULT 'candidate',
  visibility TEXT NOT NULL DEFAULT 'workspace_private',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES code_memory_sources(id),
  FOREIGN KEY (source_version_id) REFERENCES code_memory_source_versions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_code_memory_capsules_tenant_slug
  ON code_memory_capsules (tenant_id, slug);

CREATE INDEX IF NOT EXISTS idx_code_memory_capsules_tenant_status
  ON code_memory_capsules (tenant_id, approval_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS code_memory_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_memory_events_tenant_created
  ON code_memory_events (tenant_id, created_at DESC);
