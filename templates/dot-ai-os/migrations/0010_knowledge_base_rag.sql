-- knowledge-base-rag module tables. Owned by @microservices-sh/knowledge-base-rag.
-- domain_events is already created in 0001_core.sql with the shared event schema.

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'web_scan', 'file_upload', 'api_sync')),
  source_url TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  indexed_at TEXT,
  indexing_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'web_scan', 'file_upload', 'api_sync')),
  source_name TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  article_id TEXT REFERENCES knowledge_articles(id) ON DELETE SET NULL,
  attachment_id TEXT,
  file_size_bytes INTEGER,
  content_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_attachments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  article_id TEXT REFERENCES knowledge_articles(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('document', 'image', 'video', 'audio')),
  extracted_text TEXT,
  transcription TEXT,
  image_description TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  processing_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_web_scan_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  base_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  pages_scanned INTEGER NOT NULL DEFAULT 0,
  articles_created INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_feeds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('google_sheets', 'notion', 'airtable', 'csv_url')),
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  sync_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'hourly', 'daily', 'weekly')),
  last_synced_at TEXT,
  next_sync_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
  sync_error TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  articles_created INTEGER NOT NULL DEFAULT 0,
  articles_updated INTEGER NOT NULL DEFAULT 0,
  articles_deleted INTEGER NOT NULL DEFAULT 0,
  last_row_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tenant_status ON knowledge_articles (tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tenant_project ON knowledge_articles (tenant_id, project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tenant_status ON knowledge_sources (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_article ON knowledge_sources (article_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_attachments_tenant_article ON knowledge_attachments (tenant_id, article_id, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_web_scan_jobs_tenant_status ON knowledge_web_scan_jobs (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_feeds_tenant_active ON knowledge_feeds (tenant_id, is_active, updated_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_feeds_tenant_status ON knowledge_feeds (tenant_id, sync_status, updated_at);
