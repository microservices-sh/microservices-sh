CREATE TABLE IF NOT EXISTS html_render_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  html TEXT NOT NULL,
  assets_json TEXT NOT NULL DEFAULT '[]',
  ttl_seconds INTEGER,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(tenant_id, id),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_html_render_documents_slug ON html_render_documents (tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_html_render_documents_status ON html_render_documents (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_html_render_documents_expires_at ON html_render_documents (tenant_id, expires_at);
