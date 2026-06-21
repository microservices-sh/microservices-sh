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
- The initial UI is inherited from the ERP shell. Add accounting route pages in a
  focused follow-up, then update `src/lib/server/erp-nav.ts`.
- Do not vendor module internals under `src/lib/server/modules`.

Do not add payment, email, webhook, migration, secret, provider-write, or remote
deploy behavior without approval.
