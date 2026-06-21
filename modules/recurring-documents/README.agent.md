# Recurring Documents Module Agent Guide

Use this module through `@microservices-sh/recurring-documents`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm --filter @microservices-sh/recurring-documents check:spec`.
5. Run `pnpm --filter @microservices-sh/recurring-documents build` after source edits.

Mutation rules:

- Active templates can be paused, generated, or cancelled.
- Paused templates can be resumed.
- Completed and cancelled templates are terminal for generation.
- Generated drafts must be persisted by an invoice, AP, or route adapter; this module only updates recurrence tracking.
