# SaaS Starter SvelteKit Template Agent Guide

Use this template as a source-visible starting point for a multi-tenant B2B SaaS.

Safe first actions:

1. Read `microservices.template.json`.
2. Read `microservices.lock.json`.
3. Read `docs/llms.txt` and `docs/api-boundary.md`.
4. Run `pnpm check:spec`.
5. Run `pnpm microservices check --json`.

## Rules

- SvelteKit routes are adapters. Put domain behavior in module use cases, not routes.
- Gate every `/app/*` action with `authorize` / `resolvePermissions` from
  `@microservices-sh/org-team-rbac`. Non-members resolve to no permissions.
- The org id is the billing `subscriberId` — one subscription per organization.
- `/admin` is platform super-admin scope across all orgs; it is gated by the
  session `isSuperAdmin` flag, not an org role.
- Do not vendor module internals under `src/lib/server/modules`. Depend on the
  module packages and consume their exported use cases, ports, and adapters.

Do not add payment, email, auth provider, webhook, migration, secret, or
production deploy behavior without approval.
