-- file-media module tables. Owned by @microservices-sh/file-media. Object bytes
-- live in R2 (MEDIA_BUCKET); these tables hold metadata only.

CREATE TABLE IF NOT EXISTS upload_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,              -- tenant-scoped R2 key: `${tenant}/${id}/${name}`
  content_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  max_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,           -- pending | completed | expired
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Drives orphan cleanup: pending tickets ordered by expiry.
CREATE INDEX IF NOT EXISTS idx_upload_tickets_expiry ON upload_tickets(status, expires_at);

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  status TEXT NOT NULL,           -- active | deleted (soft delete)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- All listing/queries are tenant-scoped; index supports it.
CREATE INDEX IF NOT EXISTS idx_media_files_tenant ON media_files(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_key ON media_files(key);
