# Commerce Ops SvelteKit Template Agent Guide

Use this template as a source-visible starting point for a single-company
commerce operations app. It is StackSuite-informed and module-backed; do not copy
donor app business logic into SvelteKit routes.

Safe first actions:

1. Read `microservices.template.json`.
2. Read `microservices.lock.json`.
3. Read `docs/llms.txt` and `docs/api-boundary.md`.
4. Run `pnpm check:spec`.
5. Run `pnpm build` before changing route code.

## Rules

- Keep catalog, inventory, sales-order, shipment, and sync behavior in module use
  cases and adapters.
- Gate every `/app/*` action with `org-team-rbac` authorization.
- Treat commerce sync credentials as secrets; store only secret references in D1.
- Keep webhook intake idempotent and audit every accepted external payload.
- The initial UI is inherited from the ERP shell. Add commerce route pages in a
  focused follow-up, then update `src/lib/server/erp-nav.ts`.
- Do not vendor module internals under `src/lib/server/modules`.

Do not add payment, email, webhook, migration, secret, provider-write, or remote
deploy behavior without approval.
