# Passkey Auth Module Agent Guide

Use this module through `@microservices-sh/passkey-auth`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Key boundary: this module never mints sessions. `verifyAuthentication` returns the
verified `userId`; the host app creates the session. Do not re-introduce session
minting here.

Do not add provider calls, secrets, migrations, or production deploy behavior without
approval.
