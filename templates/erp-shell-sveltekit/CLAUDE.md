# Customizing this app (agent playbook)

This is a single-company **ERP shell** on SvelteKit + Cloudflare. There is ONE
company organization (no multi-tenant funnel, no org switcher). Operational
modules — customers, invoices, files, team — plug into a left-sidebar app shell.
Customization is split across a few well-defined surfaces; edit the right one.

## App shell & lock-driven sidebar → `src/lib/server/erp-nav.ts`

The left sidebar in `src/routes/app/+layout.svelte` is **derived from the
installed module set**, not hardcoded.

- `microservices.lock.json#modules[]` is the source of truth for what is
  installed. Each entry carries `contract.mount` / `permissions` / `requires`.
- `src/lib/server/erp-nav.ts` imports the lockfile, maps user-facing module ids
  to `{ label, href, icon }` (the `NAV_BY_MODULE` table), and filters to the
  intersection of *installed* and *user-facing*. `/app/+layout.server.ts` calls
  `buildNav()` and the layout renders `data.nav`.
- Install/remove a module (the normal flow updates the lock) and its sidebar
  entry appears/disappears automatically — no layout edit needed.
- **Infra modules get no nav entry**: `auth`, `identity`, `audit-log`,
  `jobs-workflows`, `notifications-inapp`, `gateway`, `idempotency`,
  `webhook-delivery`. They power the shell but expose no surface to navigate to,
  so they simply have no key in `NAV_BY_MODULE`.

To surface a newly installed module: add one row to `NAV_BY_MODULE` keyed by its
module id, then add a route under `src/routes/app/<section>`.

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
