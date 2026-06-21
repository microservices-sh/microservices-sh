CREATE TABLE IF NOT EXISTS url_short_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  original_url TEXT NOT NULL,
  custom_alias INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, id),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS url_short_link_clicks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  code TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  country TEXT,
  city TEXT,
  region TEXT,
  device_type TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  referrer TEXT,
  UNIQUE(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_url_short_links_code ON url_short_links (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_url_short_links_created_at ON url_short_links (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_url_short_link_clicks_link_id ON url_short_link_clicks (tenant_id, link_id);
CREATE INDEX IF NOT EXISTS idx_url_short_link_clicks_clicked_at ON url_short_link_clicks (tenant_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_url_short_link_clicks_country ON url_short_link_clicks (tenant_id, country);
