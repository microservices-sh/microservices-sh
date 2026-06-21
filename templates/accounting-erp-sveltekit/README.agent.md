# Accounting ERP SvelteKit Template Agent Guide

Use this template as a source-visible starting point for a single-company
accounting ERP app. It is StackSuite-informed and module-backed; do not copy
donor app accounting logic into SvelteKit routes.

Safe first actions:

1. Read `microservices.template.json`.
2. Read `microservices.lock.json`.
3. Read `docs/llms.txt` and `docs/api-boundary.md`.
4. Run `pnpm check:spec`.
5. Run `pnpm build` before changing route code.

## Rules

- Keep chart-of-accounts, journal, payable, receivable, and reconciliation
  behavior in module use cases and adapters.
- Gate every `/app/*` action with `org-team-rbac` authorization.
- Use integer cents in module APIs and UI boundaries.
- Treat posting, payment application, and bank matching as idempotent mutations.
- Ledger, payables, receivables, and banking have route-level reference UIs.
  Keep future route work module-backed and guarded.
- Do not vendor module internals under `src/lib/server/modules`.
- When Code Memory is configured, search approved Logic Capsules before writing
  reusable invoice numbering, posting, bank import, D1, or integration logic. Use
  the portal, MCP tools, or `microservices memory search/get`; do not copy
  candidate capsules without approval and provenance.

Do not add payment, email, webhook, migration, secret, provider-write, or remote
deploy behavior without approval.
