# Content CMS Module Agent Guide

Use this module through `@microservices-sh/content-cms`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Use `createContentCmsService` rather than editing D1 tables directly.
5. Run `pnpm --filter @microservices-sh/content-cms build`, `test`, and `check:spec` after source edits.

Useful workflows:

- Create a content model with `createContentType` and `addContentField`.
- Create drafts with `createContentEntry`, then publish a selected version with `publishEntry`.
- Read published-or-latest content with `getEntrySnapshot`.
- Store uploaded file metadata with `createMediaAsset`; actual R2 upload tickets stay in app adapters or `file-media`.
- Configure locales before calling `upsertLocalization`.

Do not add auth, billing, AI page design, object uploads, public rendering, migrations, or production deploy behavior without explicit approval.
