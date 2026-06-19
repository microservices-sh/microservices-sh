# Passkey Auth Module

Status: `available`

Public, source-visible passkey (WebAuthn) authentication for microservices.sh apps:
registration + authentication ceremonies + credential management, built on
[`@simplewebauthn/server`](https://simplewebauthn.dev/).

## Boundary

This module performs the WebAuthn ceremonies and persists credentials/challenges. It
**does not mint sessions**. `verifyAuthentication` returns the verified `userId` (and
emits `passkey.authenticated`); the **host app** is responsible for creating the
session (e.g. via `@microservices-sh/identity`). This keeps passkeys a pluggable
primary-login alternative without coupling to any session model.

## Public Surface

```ts
import {
  beginRegistration,
  verifyRegistration,
  beginAuthentication,
  verifyAuthentication,
  listCredentials,
  deleteCredential,
  createMemoryPasskeyStore,
  createD1PasskeyStore,
} from "@microservices-sh/passkey-auth";
```

Every use-case returns a `Result<T>` envelope (`ok`/`err` from
`@microservices-sh/connection-contract`).

## Use-cases

| Use-case             | Scope                | Public | Purpose                                                  |
| -------------------- | -------------------- | ------ | -------------------------------------------------------- |
| `beginRegistration`  | `passkey.register`   | no     | Session-gated. Generate registration options + challenge. |
| `verifyRegistration` | `passkey.register`   | no     | Verify attestation, persist the credential.              |
| `beginAuthentication`| `passkey.authenticate`| yes   | Generate assertion options + challenge.                  |
| `verifyAuthentication`| `passkey.authenticate`| yes  | Verify assertion, bump counter, **return `userId`**.     |
| `listCredentials`    | `passkey.admin`      | no     | List a user's registered passkeys.                       |
| `deleteCredential`   | `passkey.admin`      | no     | Delete a passkey scoped to its owner.                    |

## Ports & adapters

The use-cases depend on a single `PasskeyStore` port. Two adapters implement it:

- `createMemoryPasskeyStore()` — Maps, for tests + local dev. Canonical unit coverage.
- `createD1PasskeyStore(db)` — D1-backed, against `migrations/0001_passkey_auth.sql`.

WebAuthn crypto is isolated behind injectable `verify` dependencies so orchestration
(challenge lifecycle, counter/replay, persistence, events) is unit-testable without
real attestation.

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and
the `passkey_credentials` / `passkey_challenges` migration. Templates own app shell,
route adapters, UI, session creation, and framework-specific response mapping.
