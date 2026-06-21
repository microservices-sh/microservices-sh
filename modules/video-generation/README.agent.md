# Video Generation Module Agent Guide

Use this module through `@microservices-sh/video-generation`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Use `createVideoGenerationService` instead of editing D1 tables directly.
5. Run `pnpm --filter @microservices-sh/video-generation build`, `test`, and `check:spec` after source edits.

Useful workflows:

- Create a draft generation task with `createVideoJob`.
- Submit it only when a host supplies an approved provider port.
- Reconcile provider polling or webhook results with `recordVideoProviderStatus`.
- Attach app-owned R2/file records with `attachVideoOutput` after a route adapter downloads/finalizes bytes.

Do not add provider credentials, billing, auth, moderation, R2 downloads, signed URLs, webhooks, migrations, or production deploy behavior without approval.
