# Identity Module Agent Guide

Use this module through `@microservices-sh/identity`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

This module is passwordless email-code login + server-side sessions, built directly
on `@microservices-sh/auth` (no third-party auth dependency). It owns the `accounts`,
`login_codes`, and `sessions` D1 tables and bridges an authenticated session to a
short-lived scoped service token via the auth module.

Security invariants (do not weaken):

- Login codes are NEVER stored in plaintext — only a salted SHA-256 hash (`sha256Hex`).
- Code comparison is timing-safe (`constantTimeEqual`).
- Service tokens are minted through `@microservices-sh/auth`, not signed locally.

Do not add provider calls, secrets, migrations, session-token changes, or production
deploy behavior without approval. This module is `risk: high`.
