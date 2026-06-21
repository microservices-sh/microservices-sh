# Accounting Core Module Agent Guide

Use this module through `@microservices-sh/accounting-core`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm test` for focused accounting invariants.
6. Run `pnpm build` after source edits.

Do not edit posted entries directly. Corrections must use `voidJournalEntry`, which marks the original and creates a posted reversal entry. Do not add route adapters, shared template wiring, external provider calls, production deploy behavior, or edits outside `modules/accounting-core/**` from this module.
