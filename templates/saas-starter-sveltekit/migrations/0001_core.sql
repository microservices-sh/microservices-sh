-- Core tables shared by the SaaS starter: auth signing keys, a domain event
-- stream, and the append-only audit trail. Module-owned tables follow in later
-- migrations. These schemas mirror the module migrations they belong to.

-- auth module: signing keys for inter-service tokens.
-- SECURITY: private_jwk is plaintext for the prototype only. In production the
-- private key MUST be wrapped by a secret/KMS binding, never persisted in D1.
CREATE TABLE IF NOT EXISTS signing_keys (
  kid TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  private_jwk TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retired_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_signing_keys_status ON signing_keys(status);

-- Domain event stream (auth + other modules append here).
CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_events_entity ON domain_events(entity_type, entity_id);

-- audit-log module: append-only audit trail.
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
