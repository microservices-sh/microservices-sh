# Storage Entitlements Module Agent Guide

Use this module through `@microservices-sh/storage-entitlements`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm --filter @microservices-sh/storage-entitlements check:spec`.
5. Run `pnpm --filter @microservices-sh/storage-entitlements build` after source edits.

Mutation rules:

- Check quota before recording stored bytes.
- Complete each purchase once; external session ids are idempotency keys.
- Share links expire at 1, 7, or 30 days and can be revoked.
- This module does not sign R2 URLs or delete objects.
