# Project Progress Module Agent Guide

Use this module through `@microservices-sh/project-progress` to operate customer-facing project timelines and worker upload/comment workflows.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Use `createProjectProgressService` instead of writing store rows directly.
5. Run `pnpm --filter @microservices-sh/project-progress check:spec`.
6. Run `pnpm --filter @microservices-sh/project-progress build` after source edits.

Boundaries:

- Treat `customerId`, `userId`, `authorName`, comments, media keys, and access tokens as sensitive.
- Do not expose public project snapshots without a route-level access policy.
- Do not add raw uploads, R2 signing, QR generation, email sending, provider calls, migrations, or production deploy behavior without approval.
- Keep auth/customer ownership in their own modules; this module accepts ids as integration references.
