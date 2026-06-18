# DOT AI OS Template Agent Guide

Use this template as a source-visible starting point for an operator OS: one
workspace, role-based team access, task routing, focus planning, calendar
context, daily review, knowledge logs, content pipeline, AI team roster, files,
contacts, work packets, and support inbox.

Safe first actions:

1. Read `CLAUDE.md`.
2. Read `microservices.template.json`.
3. Read `microservices.lock.json`.
4. Read `docs/llms.txt` and `docs/api-boundary.md`.
5. Run `pnpm build` then `pnpm check:spec`.

## Rules

- SvelteKit routes are adapters. Put domain behavior in module use cases, not routes.
- Gate every `/app/*` action with `authorize` / `resolvePermissions` from
  `@microservices-sh/org-team-rbac`.
- This is a single workspace template: `/signup` is first-run setup, not a public tenant funnel.
- The sidebar is derived from `microservices.lock.json` via
  `src/lib/server/erp-nav.ts`; add a module mapping there to surface installed modules.
- Task, focus, and daily-review state is owned by `@microservices-sh/operator-work`.
  Use its use cases; do not write `operator_*` tables directly.
- Upstream-inspired calendar, knowledge, content, and AI-team sample data still
  lives in `src/lib/os-data.ts` until dedicated modules own those domains.
- `/admin` is platform super-admin scope, gated by the session `isSuperAdmin`
  flag, not an org role.
- Do not vendor module internals under `src/lib/server/modules`.

Do not add payment, email, auth provider, webhook, migration, secret, Hermes
ingestion, Obsidian export, calendar write-back, AI-provider calls, or production
deploy behavior without approval.
