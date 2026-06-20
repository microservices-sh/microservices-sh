CREATE TABLE IF NOT EXISTS document_extraction_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_id TEXT,
  status TEXT NOT NULL,
  target_type TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  requested_mode TEXT NOT NULL,
  selected_runtime TEXT,
  source_file_id TEXT,
  source_key TEXT,
  source_mime_type TEXT NOT NULL,
  source_original_name TEXT,
  source_page_count INTEGER,
  source_bytes INTEGER,
  source_sha256 TEXT,
  draft_json TEXT,
  approved_output_json TEXT,
  review_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_extraction_jobs_tenant_status
  ON document_extraction_jobs (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_document_extraction_jobs_owner
  ON document_extraction_jobs (tenant_id, owner_id, created_at);
