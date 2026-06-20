CREATE TABLE IF NOT EXISTS marketing_briefs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  summary TEXT NOT NULL,
  implications_json TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  coverage_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_briefs_owner_created
  ON marketing_briefs (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS signal_snapshots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  engagement INTEGER,
  captured_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signal_snapshots_owner_topic
  ON signal_snapshots (owner_id, topic, captured_at DESC);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_events_entity
  ON domain_events (entity_type, entity_id, created_at DESC);
