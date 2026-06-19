-- Decision module (Advise pillar) schema.

CREATE TABLE IF NOT EXISTS decision_briefs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  context TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  options_json TEXT NOT NULL,
  risks_json TEXT NOT NULL,
  assumptions_json TEXT NOT NULL,
  recommendation_json TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_briefs_owner ON decision_briefs (owner_id);
CREATE INDEX IF NOT EXISTS idx_decision_briefs_status ON decision_briefs (status);

-- Append-only decision log: never updated, full history preserved.
CREATE TABLE IF NOT EXISTS decision_logs (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  choice TEXT NOT NULL,
  rationale TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  decided_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_logs_brief ON decision_logs (brief_id, decided_at);

CREATE TABLE IF NOT EXISTS domain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decision_domain_events_entity ON domain_events (entity_type, entity_id);
