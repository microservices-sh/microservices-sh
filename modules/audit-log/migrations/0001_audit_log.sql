-- Audit log owns an append-only event trail. Records are never updated or deleted.
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  actor_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  source TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_name ON audit_events(event_name);
