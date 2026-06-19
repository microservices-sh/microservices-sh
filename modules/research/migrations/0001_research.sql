-- Research module (Research pillar) schema. Vectors live in Cloudflare Vectorize, not D1.

CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  uri TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_sources_owner ON research_sources (owner_id);

CREATE TABLE IF NOT EXISTS research_briefs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_briefs_owner ON research_briefs (owner_id);

CREATE TABLE IF NOT EXISTS domain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_research_domain_events_entity ON domain_events (entity_type, entity_id);
