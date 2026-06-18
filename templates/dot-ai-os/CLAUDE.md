# Customizing DOT AI OS

This is an agent-native operator workspace on SvelteKit + Cloudflare. There is
one workspace organization. Modules provide the risky production behavior; the
template owns app chrome, routes, layout, and DOT AI OS workflow surfaces.

## App Shell And Sidebar

The left sidebar in `src/routes/app/+layout.svelte` is derived from the installed
module set, not hardcoded.

- `microservices.lock.json#modules[]` is the source of truth.
- `src/lib/server/erp-nav.ts` maps user-facing module ids to labels and routes.
- Install/remove a module through the normal flow and update the lock; then add a
  nav mapping only when the module should expose a screen.
- Infra modules such as `auth`, `identity`, `audit-log`, `jobs-workflows`,
  `notifications-inapp`, `gateway`, and `webhook-delivery` normally have no nav
  entry.

## Module Wiring

Module stores are constructed in `src/lib/server/stores.ts` and attached to
`event.locals` in `src/hooks.server.ts`. Routes call module use cases with
`locals.<store>` and should never import concrete adapters directly.

## Workspace Model

`src/lib/server/org-context.ts` resolves the workspace org for the signed-in user.
The cookie remembers which org to use; the RBAC store remains the authority. First
run setup at `/signup` creates the workspace via `org-team-rbac`.

## DOT AI OS Workflow Pages

These pages are template-owned starter surfaces:

- `/app/tasks`
- `/app/focus`
- `/app/calendar`
- `/app/review`
- `/app/knowledge`
- `/app/content`
- `/app/ai-team`

The starter workflow data lives in `src/lib/os-data.ts`. Keep these routes thin
until a dedicated module owns persisted data. Calendar OAuth/write-back, Hermes
ingestion, Obsidian export, AI-provider calls, and external ingestion require
explicit approval gates.

## Admin Registry

`src/lib/server/admin-registry.ts` registers table-backed resources for the
super-admin console. Add resources there only when the underlying table belongs
to an installed module or a documented template-owned table.

## Public Copy

`src/routes/+page.svelte` is data-driven through `src/content.json`. The contract
is `content.schema.json`; validate with `npm run validate`.

## Don't

- Don't hardcode sidebar entries in the layout.
- Don't put module internals under `src/lib/server/modules`.
- Don't add secrets, remote migrations, calendar write-back, payment/email
  provider behavior, Hermes ingestion, Obsidian export, AI calls, or production
  deploy behavior without approval.
