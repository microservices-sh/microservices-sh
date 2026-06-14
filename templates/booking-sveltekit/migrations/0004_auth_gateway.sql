-- Auth signing keys (EdDSA) and gateway API keys for auth-gated access.
-- SECURITY: signing_keys.private_jwk and api_keys are sensitive. In production
-- wrap the private key with a secret/KMS binding and never log raw API keys.
CREATE TABLE IF NOT EXISTS signing_keys (
  kid TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  private_jwk TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retired_at TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  workspace TEXT NOT NULL,
  project TEXT NOT NULL,
  subject TEXT NOT NULL,
  scopes TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signing_keys_status ON signing_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(hash);
