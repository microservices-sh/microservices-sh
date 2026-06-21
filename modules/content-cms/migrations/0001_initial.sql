CREATE TABLE IF NOT EXISTS cms_content_types (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  api_id TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_singleton INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  sort_field TEXT NOT NULL DEFAULT 'createdAt',
  sort_order TEXT NOT NULL DEFAULT 'desc',
  display_field TEXT NOT NULL DEFAULT 'title',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, api_id)
);

CREATE TABLE IF NOT EXISTS cms_content_fields (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  content_type_id TEXT NOT NULL,
  name TEXT NOT NULL,
  api_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  validation_json TEXT NOT NULL DEFAULT '{}',
  default_value_json TEXT NOT NULL DEFAULT 'null',
  is_required INTEGER NOT NULL DEFAULT 0,
  is_unique INTEGER NOT NULL DEFAULT 0,
  is_localizable INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  field_group TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, content_type_id, api_id),
  FOREIGN KEY (tenant_id, content_type_id) REFERENCES cms_content_types (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_content_entries (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  content_type_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  published_version INTEGER,
  scheduled_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, content_type_id) REFERENCES cms_content_types (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_content_entry_versions (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  change_description TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, entry_id, version),
  FOREIGN KEY (tenant_id, entry_id) REFERENCES cms_content_entries (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_content_entry_localizations (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  entry_version_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  translated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, entry_version_id, locale),
  FOREIGN KEY (tenant_id, entry_version_id) REFERENCES cms_content_entry_versions (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_locales (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  native_name TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  fallback_locale TEXT,
  direction TEXT NOT NULL DEFAULT 'ltr',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS cms_media_assets (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  storage_key TEXT NOT NULL,
  public_url TEXT,
  alt TEXT,
  caption TEXT,
  title TEXT,
  description TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  folder TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  uploaded_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cms_content_fields_type_position ON cms_content_fields (tenant_id, content_type_id, position);
CREATE INDEX IF NOT EXISTS idx_cms_entries_type_status ON cms_content_entries (tenant_id, content_type_id, status);
CREATE INDEX IF NOT EXISTS idx_cms_entries_published_at ON cms_content_entries (tenant_id, published_at);
CREATE INDEX IF NOT EXISTS idx_cms_versions_entry ON cms_content_entry_versions (tenant_id, entry_id, version);
CREATE INDEX IF NOT EXISTS idx_cms_localizations_locale ON cms_content_entry_localizations (tenant_id, locale, status);
CREATE INDEX IF NOT EXISTS idx_cms_locales_default ON cms_locales (tenant_id, is_default);
CREATE INDEX IF NOT EXISTS idx_cms_media_folder ON cms_media_assets (tenant_id, folder);
CREATE INDEX IF NOT EXISTS idx_cms_media_created_at ON cms_media_assets (tenant_id, created_at);
