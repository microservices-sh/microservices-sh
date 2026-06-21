# Inventory Module Agent Guide

Use this module through `@microservices-sh/inventory`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Important boundaries:

- Do not edit templates, shared catalogs, lock files, or docs registry files from this module.
- Do not call external providers from inventory use cases.
- Treat movement rows as the source of truth; do not add cached stock-balance state without a separate design review.
- Use source references for idempotent reserve, release, deduction, and reconciliation operations.
