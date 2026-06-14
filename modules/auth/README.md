# Auth Module

Platform module that issues and verifies the short-lived tokens used for
auth-gated inter-service communication (see `plans/24-service-topology-and-auth-comms.md`).

## What it does

- Mints short-lived **EdDSA (Ed25519) JWTs** carrying `{ sub, workspace, project, scopes, exp }`.
- Verifies token signature + expiry against the published key for its `kid`.
- Publishes a **JWKS** so every other service verifies tokens locally with the
  public key — the private key never leaves this module.
- Provides `requireScope(claims, scope)` for callee-side scope enforcement.
- Manages signing keys (`rotateSigningKey`) with retire-then-promote rotation.

Asymmetric by design: with many services a shared HS256 secret would have to be
distributed to every verifier. EdDSA keeps the private signing key in `auth`
only; verifiers hold the public key.

## Surface

| Use case | Scope | Purpose |
|----------|-------|---------|
| `mintToken` | `auth.mint` | Issue a scoped, short-lived token |
| `verifyToken` | `auth.verify` | Validate signature + expiry, return claims |
| `getJwks` | public | Public keys for local verification |
| `rotateSigningKey` | `auth.admin` | Generate + promote a new signing key |

`requireScope` / `hasScope` are exported for callee services.

## Deps

Persistence is behind `SigningKeyStore` (`src/ports`). Adapters:
`createD1SigningKeyStore(db)` for Cloudflare D1 and
`createMemorySigningKeyStore()` for tests.

## Provisioning

Run `rotateSigningKey` once after migration to create the first active key, then
`mintToken` will succeed. Rotate periodically; retired keys stay in JWKS so
in-flight tokens still verify until they expire.

## Security notes

- The prototype stores `private_jwk` in D1. **Production must wrap the private
  key with a secret/KMS binding** (see `migrations/0001_auth.sql`).
- Token TTL defaults to 60s; keep it short.
- Never log token values or private keys.
