-- Auth module owns signing keys for inter-service tokens.
-- SECURITY: private_jwk is stored here for the prototype. In production the
-- private key MUST be wrapped by a secret/KMS binding and never persisted in
-- plaintext D1. The public key (public_jwk) is safe to store and publish.
CREATE TABLE IF NOT EXISTS signing_keys (
  kid TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  private_jwk TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retired_at TEXT
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signing_keys_status ON signing_keys(status);
CREATE INDEX IF NOT EXISTS idx_auth_domain_events_entity ON domain_events(entity_type, entity_id);
