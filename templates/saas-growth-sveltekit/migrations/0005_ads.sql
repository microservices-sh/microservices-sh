-- Ads Manager module tables (ads-manager owns this contract). Connection
-- references (no platform tokens — those live in the upstream ads service),
-- per-day insight snapshots, and anomaly alerts.

CREATE TABLE IF NOT EXISTS ad_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL,
  external_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_connections_tenant ON ad_connections(tenant_id, status);

CREATE TABLE IF NOT EXISTS ad_insight_snapshots (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  date TEXT NOT NULL,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  cpc_cents INTEGER NOT NULL DEFAULT 0,
  roas REAL,
  raw TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (connection_id, campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ad_snapshots_tenant_date ON ad_insight_snapshots(tenant_id, date);

CREATE TABLE IF NOT EXISTS ad_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  metric_before REAL,
  metric_after REAL,
  date TEXT NOT NULL,
  fired_at TEXT NOT NULL,
  acknowledged_at TEXT,
  UNIQUE (connection_id, campaign_id, type, date)
);
CREATE INDEX IF NOT EXISTS idx_ad_alerts_tenant ON ad_alerts(tenant_id, fired_at);
