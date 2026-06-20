# Customizing this app (agent playbook)

This is a single-company **ERP shell** on SvelteKit + Cloudflare. There is ONE
company organization (no multi-tenant funnel, no org switcher). Operational
modules — customers, invoices, files, team — plug into a left-sidebar app shell.
Customization is split across a few well-defined surfaces; edit the right one.

## Selectively enabling module UI → see `docs/module-ui-playbook.md`

**Read `docs/module-ui-playbook.md` before adding or toggling a module's UI.**
It is the authoritative guide; the summary:

- The left sidebar (`src/routes/app/+layout.svelte`) is **derived from the ENABLED
  module set**, not hardcoded. `src/lib/server/erp-nav.ts` maps user-facing module
  ids to nav metadata (`MODULE_NAV`) and shows only those that are enabled.
- **Installed** = present in `microservices.lock.json` (vendored + wired).
  **Enabled** = surfaced here, resolved by `src/lib/server/modules.ts` from
  `ENABLED_MODULES` env → `src/lib/modules.config.ts` → all installed.
- `requireModule(id, platform)` in each module route's `load` returns 404 when the
  module is disabled, so turning a module off (omit it in `modules.config.ts`)
  hides the nav entry **and** blocks the routes — not just cosmetic.
- **Pure infra modules get no nav entry** (`auth`, `identity`, `email`, `gateway`,
  `audit-log`, `idempotency`). Platform modules with operator consoles
  (`jobs-workflows`, `webhook-delivery`) can be mapped in `erp-nav.ts`.

To surface a module: add a `MODULE_NAV` row + a route under `src/routes/app/<section>`
(call `requireModule(...)` first). The existing pages (`customers`, `invoices`,
`notifications`) are reference samples to copy and adapt — full recipe in the playbook.

## Module wiring → `src/lib/server/stores.ts` + `src/hooks.server.ts`

Module stores (D1/R2-backed in prod, memory in dev) are constructed in
`stores.ts` and attached to `event.locals` in `hooks.server.ts`. Routes are thin
adapters that call module **use cases** with `locals.<store>` — never adapters
directly. `src/lib/server/demo.ts` seeds the in-memory stores locally.

## Single-company model → `src/lib/server/org-context.ts`

`loadCompanyContext` resolves the one company org the signed-in employee belongs
to (re-validated against the RBAC store every request; the cookie only remembers
*which* org). `requireOrgPermission` is the per-route gate. First-run setup
(`/signup`) creates the single company org via `org-team-rbac createOrganization`.

## Generic CRUD → `src/lib/server/admin-registry.ts`

The super-admin console (`/admin`) is schema-driven CRUD over D1 via admin-shell.
`adminRegistry` registers `organizations`, `memberships`, `customers`, and
`invoices` as resources (table + columns only — never request input — which keeps
the gateway injection-safe). Add a resource here to expose another table.

## Public copy → `src/content.json`

`src/routes/+page.svelte` is data-driven (it normally redirects into the app).
The contract is in `content.schema.json`; validate with `npm run validate`
(also runs before `npm run build`).

## Don't

- Don't edit `src/content.types.ts` — it's generated from the schema.
- Don't hardcode sidebar entries in the layout — change `NAV_BY_MODULE`.
- Don't own module internals under `src/lib/server/modules` — the spec check
  (`npm run check:spec`) forbids it.
