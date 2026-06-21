-- @microservices-sh/file-media schema for customer document uploads.
-- Object bytes live in R2; these tables hold upload tickets and file metadata.

CREATE TABLE IF NOT EXISTS upload_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_id TEXT,
  key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  max_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_upload_tickets_expiry ON upload_tickets (status, expires_at);

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_id TEXT,
  key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_files_tenant ON media_files (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_owner ON media_files (tenant_id, owner_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_key ON media_files (key);
