# Module UI playbook (agent guide)

How to surface a module in this ERP shell — and how to **adapt** the reference UI
to a real business. Written for an AI coding agent (or a developer) customizing a
generated app.

## Mental model

- **Modules are framework-neutral.** A module (`modules/<id>`) ships use-cases,
  ports, schemas, events, and — for admin CRUD — `resources`. It contains **zero
  UI** (no `.svelte`). It never imports SvelteKit.
- **The shell owns the UI.** Every screen lives in this template under
  `src/routes/app/<section>`. A route is a thin adapter: it calls the module's
  **use-cases** with `locals.<store>` and renders the result with the `$lib/ui`
  design system. Never call a module's adapter (store) directly from a route, and
  never reach into `src/lib/server/modules/*`.
- **Reference pages are samples, not gospel.** The pages shipped here
  (`customers`, `invoices`, …) are a *correct, working starting point*. Copy the
  pattern, then adapt names, fields, columns, and styling to the business.

## Installed vs enabled

- **Installed** = vendored + wired (present in `microservices.lock.json`). Done
  via `microservices add <id>` plus the wiring steps below.
- **Enabled** = surfaced in this deployment. Controlled by, in precedence order:
  1. `ENABLED_MODULES` env (comma-separated ids) — per-environment override
  2. `src/lib/modules.config.ts` (`enabledModules`) — committed per-workspace choice
  3. all installed — default
- `src/lib/server/modules.ts` resolves this. The sidebar (`erp-nav.ts`) shows a
  module only if it's enabled, and `requireModule(id, platform)` in each route's
  `load` returns 404 when it isn't — so disabling is real, not cosmetic.

**To turn a wired module off:** list the ones you want in `modules.config.ts`
(omit the rest), or set `ENABLED_MODULES`. No code deletion needed.

## Add UI for a module — the recipe

Worked reference: `src/routes/app/customers/` (list + create) and
`src/routes/app/invoices/` (list + multi-step create + per-row action).

1. **Install the module** (if not already): `microservices add <id>` (this vendors
   it AND records it in `microservices.lock.json#modules[]`), then add
   `"@microservices-sh/<id>": "workspace:*"` (repo) / `"file:./modules/<id>"`
   (generated app) to `package.json` and reinstall. **If you wire by hand, you
   MUST add the lock entry yourself** — `installedModuleIds()` reads the lock, so
   a module absent from it is treated as not installed and its routes 404.
2. **Wire the store** — construct the module's adapter in `src/lib/server/stores.ts`
   (`db ? createD1XStore(db) : memoryXStore`), add it to `ServerStores`, assign it
   on `event.locals` in `src/hooks.server.ts`, and type it in `src/app.d.ts`.
3. **Migration** — copy the module's `migrations/*.sql` into this app's
   `migrations/` as the next-numbered file (`000N_<id>.sql`). Reuse shared tables
   (e.g. `domain_events` lives in `0001_core.sql`).
4. **Route** — `src/routes/app/<section>/+page.server.ts`:
   - `load`: `requireModule("<id>", platform)` first, then gate with
     `requireOrgPermission(..., "org.read", ...)`, then call the module's **list**
     use-case with `locals.<store>` and return plain data.
   - `actions`: one per write use-case. Gate with the right permission
     (`member.manage` for create/update), call the use-case, `recordEvent(...)`,
     return `{ ok: true }` or `fail(status, { error })`.
5. **Page** — `+page.svelte` using `$lib/ui` (`Card`, `Eyebrow`, `Badge`,
   `Button`, `Field`, `Alert`). List view + a form per action; convert money to
   cents and rates to basis points client-side where the schema expects them.
   Include an empty state.
6. **Nav** — add `"<id>": { label, href }` to `MODULE_NAV` in `erp-nav.ts` and
   put the id in `OPERATIONS` or `ORGANIZATION`. Infra modules get no entry.
7. **Admin CRUD (optional)** — register the module's table(s) in
   `src/lib/server/admin-registry.ts` to expose them in `/admin`.
8. **Enable** — it's enabled by default once installed; to scope, update
   `modules.config.ts` / `ENABLED_MODULES`.

## Adapting the sample to the business

The reference page is deliberately generic. When customizing:
- Rename labels/sections to the domain ("Clients" not "Customers"; "Bills").
- Show the fields that matter; hide module fields the business doesn't use.
- Add derived columns/filters over the same use-case results.
- Keep the **server contract** (use-case inputs/outputs) intact — adapt the view,
  not the module. If you need new behavior, add a use-case to the module, don't
  bypass it from the route.

## Module → UI surface catalog

| Module | Surface | Reference page |
|---|---|---|
| product-catalog | Products — SKU, pricing, and stock policy | ✅ `app/products` |
| inventory | Inventory — balances, movements, and receiving | ✅ `app/inventory` |
| sales-order | Sales orders — draft order intake and ledger | ✅ `app/sales-orders` |
| shipment | Shipments — fulfillment batches and items | ✅ `app/shipments` |
| commerce-sync | Commerce sync — connection, mapping, sync, webhook review | ✅ `app/commerce-sync` |
| customer | Customers — list + create | ✅ `app/customers` |
| invoice | Invoices — issue + record payment | ✅ `app/invoices` |
| support-ticket | Support — list + open + status | ✅ `app/support` |
| notifications-inapp | Notifications — user feed + mark read | ✅ `app/notifications` |
| file-media | Files — list + upload | ✅ `app/files` |
| org-team-rbac | Team — members + invites | ✅ `app/team` |
| payment | Payments — ledger + refunds | ✅ `app/payments` |
| billing-subscriptions | Billing — plans + subscriptions | ✅ `app/billing` |
| image-generation | Images — prompt + gallery (bytes served by `[id]/+server.ts`) | ✅ `app/images` |
| ads-manager | Ads — connections, alerts, performance review, copy drafts, and publish plan (live insights need the upstream connector) | ✅ `app/ads` |
| forms-intake | Forms — define forms + review submissions (public submit is a separate surface) | ✅ `app/forms` |
| booking | Bookings — schedule list + cancel (create needs seeded services) | ✅ `app/bookings` |
| jobs-workflows | Jobs — queue health, manual enqueue, schedules, and catch-up controls | ✅ `app/jobs` |
| webhook-delivery | Webhooks — endpoints, redacted signing status, delivery log, and safe test delivery | ✅ `app/webhooks` |
| auth, identity, email, gateway, audit-log, admin-shell, idempotency | infra | — no user UI by design |
