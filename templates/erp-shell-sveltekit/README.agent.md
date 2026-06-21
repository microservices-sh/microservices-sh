# ERP Shell SvelteKit Template Agent Guide

Use this template as a source-visible starting point for a single-company ERP:
one org, role-based employees, and operational modules behind a lock-driven
sidebar.

Safe first actions:

1. Read `CLAUDE.md` (lock-driven sidebar + wiring map).
2. Read `microservices.template.json`.
3. Read `microservices.lock.json`.
4. Read `docs/llms.txt` and `docs/api-boundary.md`.
5. Run `pnpm build` then `pnpm check:spec`.

## Rules

- SvelteKit routes are adapters. Put domain behavior in module use cases, not routes.
- Gate every `/app/*` action with `authorize` / `resolvePermissions` from
  `@microservices-sh/org-team-rbac`. Non-members resolve to no permissions.
- This is single-company: there is ONE org and no org switcher. `/signup` is a
  one-time setup, not a public tenant funnel.
- The sidebar is derived from `microservices.lock.json` via
  `src/lib/server/erp-nav.ts` — add a `NAV_BY_MODULE` row to surface a module, do
  not hardcode entries in the layout.
- `/admin` is platform super-admin scope; it is gated by the session
  `isSuperAdmin` flag, not an org role.
- Do not vendor module internals under `src/lib/server/modules`. Depend on the
  module packages and consume their exported use cases, ports, and adapters.
- When Code Memory is configured, search approved Logic Capsules before writing
  reusable auth, billing, booking, D1, or integration logic. Use the portal, MCP
  tools, or `microservices memory search/get`; do not copy candidate capsules
  without approval and provenance.
- `project-progress` owns project timelines, access grants, comments, and public
  token snapshots. ERP shell routes may adapt those use cases, but must not write
  project tables directly or expose raw media storage keys on public routes.

Do not add payment, email, auth provider, webhook, migration, secret, or
production deploy behavior without approval.
