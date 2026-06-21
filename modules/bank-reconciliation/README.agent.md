# Bank Reconciliation Module Agent Guide

Use this module through `@microservices-sh/bank-reconciliation`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm test`.
6. Run `pnpm build`.

Do not add route adapters, shared template wiring, external bank-provider calls, or edits outside `modules/bank-reconciliation/**` from this module.

Money is represented as signed integer cents. Statement deposits are positive and withdrawals are negative.
