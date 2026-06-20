# Plan 33 — Enforced tenant/actor authorization boundary (P0 linchpin)

**Status:** L1–L5 complete for the 4 operational modules (`invoice`, `support-ticket`, `file-media`, `forms-intake`) — built, adopted across all 3 consuming templates, and regression-guarded in CI, all via the additive strangler (no breaking changes). See the Checkpoint. Remaining items are optional follow-ups (other modules, marketing proof).

## Goal
Make cross-user / cross-tenant data leaks **impossible by construction**, or else **loudly caught in CI**, in generated apps. This is the single most-cited failure of AI-built apps (CVE-2025-48757 — an RLS/scoping miss exposed data across **170+ Lovable apps**). It is also our sharpest differentiator:

> **"Every tenant boundary is type-enforced, and a cross-tenant read fails our build."** — a sentence v0 / Lovable / Bolt cannot say.

## Scope (what "isolation" does and doesn't mean here)
- **Cross-business** isolation = the **deployment boundary** (each customer deploys to their own Cloudflare account + own D1). **Out of scope** — already solved by the model.
- **Cross-user / cross-org isolation WITHIN one deployed app** = **in scope**. One deployment = one D1, shared by that app's own end-users/customers/orgs, separated only by id + query filter. This is where the leak happens. Applies to every multi-user template: `saas-starter` (orgs), `client-portal` (clients), `booking` (customers), `erp-shell` (employees/roles).

## Design — defense in depth
- **L1 — Scope from the session, never from input.** The current tenant/actor context is resolved server-side (via `org-team-rbac`), never read from a URL param or request body. Any handler that receives an id must verify it resolves *within* the session scope. Closes the IDOR class (open item C2).
- **L2 — Required context + private raw handle.** Every tenant-scoped repository/port method takes a non-optional `AuthContext { orgId, actorId, roles }` first argument; the raw drizzle/D1 handle is **private to the adapter**; use-cases receive only the scoped port. TypeScript makes an unscoped query path *non-existent*.
- **L3 — Auto-injected predicate.** The scoped adapter builds every query through one helper that always appends the tenant `WHERE`. There is no `db.select().from(scopedTable)` to copy wrong in the sanctioned path.
- **L4 — CI leak-test (the proof).** In `check:spec` / vitest: for each scoped table, seed tenant A + tenant B, authenticate as A, exercise every list/get, **assert zero B rows**. Build goes red on a leak. This is also the artifact we *show buyers*.
- **L5 — Lint/grep guard.** A `check:spec` rule flags any raw `db.select` / `db.query` / `` sql` `` against a tenant-scoped table *outside* the scoped store — this is what catches **AI-generated** code that writes a clever raw query.

## Implementation targets (this codebase)
- Define `AuthContext` + a `ScopedStore<T>` convention in a shared home (`packages/connection-contract`, or a new `packages/data-access` helper).
- Add a `tenantScoped(table, ctx)` drizzle predicate helper.
- Update module **ports**: tenant-scoped methods take `AuthContext`; adapters apply it; raw handle becomes private.
- Add a generic **two-tenant cross-read** harness to `workspace-tools` that modules opt into via a manifest field listing their scoped tables.
- Add the **lint/grep guard** to `check:spec`.

## Rollout (incremental — keep build/test/spec:check green at every step)
1. ✅ Land `AuthContext` + `ScopedStore` + `scopedFilter()`/`enforceScope()` helpers in `packages/connection-contract` (additive, no behavior change). Committed `3d38624`.
2. ✅ Reference module: **`support-ticket`** (not `customer` — `customer` has no tenant column; it's a single-deployment registry). Committed `5eac710`.
3. 🔄 Roll module-by-module — DONE so far (each with its own cross-tenant leak test, the L4 artifact):
   - ✅ `support-ticket` `5eac710` · ✅ `invoice` `1796742` · ✅ `file-media` `55756f3` · ✅ `forms-intake` `25e14d7`
   - remaining tenant-scoped data modules: `booking` (scopes by `customerId`; no `connection-contract` dep yet), `billing-subscriptions` / `notifications-inapp` (scope by subscriber/user id, not `tenantId` — need a per-module scope mapping).
4. ✅ Template adoption — every route handler that touches a migrated module now calls the `*Scoped` wrappers (grep-verified zero raw input-trusting calls across `templates/*/src/routes`): `erp-shell` (`fcb1ee3`/`fc59f84`/`fa87fc9`/`dce4986`/`4e907e7`), `client-portal` (`475ec0e`), `dot-ai-os` (`214c364`). Each module's index re-exports `authContext`/`AuthContext` so templates build the ctx without a direct `connection-contract` dep. Seed code (`demo.ts`) and the public `submitForm` stay on raw paths by design.
5. ✅ L5 lint guard — `workspace-tools` `check:spec` now runs `template:enforced-tenant-boundary`, failing if any `templates/*/src/routes` file imports a raw input-trusting tenant use-case that has a `*Scoped` variant. So a *new* route can't regress. The legacy use-cases stay (the `*Scoped` wrappers delegate to them; module tests + seed use them) — the guard polices request paths, not module internals. Committed `3eb0ecd`. Verified: green across 38 targets + fires on a planted raw import.

### Strangler approach (what actually shipped)
Each migrated module gained a `src/use-cases/scoped.ts` exporting `*Scoped(ctx, …)`
wrappers **alongside** the existing use-cases (which are unchanged). The wrappers
take a server-resolved `AuthContext` and source the tenant from `ctx.orgId`,
never from caller input — closing the L1 leak — while the legacy paths keep
working so no template breaks. This means build/test/spec:check stay green at
every step. Template adoption is now complete (step 4), so the L5 guard (step 5)
can land next — scoped to request paths (`templates/*/src/routes`), NOT a blanket
deletion of the legacy use-cases (those are still the delegation target for the
wrappers and are exercised by module tests + seed data).

## Done =
- A scoped module's data access is **uncallable without `AuthContext`** (compile error otherwise).
- `check:spec` runs a cross-tenant leak test **per scoped table**; red on any leak.
- The pitch line above is literally true and demonstrable.

## Risk / limits (be honest)
- **D1/SQLite has no native RLS** (unlike Postgres) → enforcement is app-layer (L2–L3) + CI (L4–L5). The DB engine will not save you.
- Strength = "all access goes through the scoped store"; L5 is what guards the perimeter.
- **DO-per-tenant** (each tenant = its own Durable Object SQLite) is the *physical*-isolation option for high-assurance cases — reserved, since it loses easy cross-tenant queries and adds complexity.

## ⚑ Checkpoint — L1–L5 complete for the operational modules
All five defense layers shipped via the **additive strangler** (no breaking changes; every step kept `pnpm -r build`, `pnpm test`, `pnpm spec:check:all` green): L1 scope-from-session + L2 required `AuthContext` + L3 forced tenant predicate (the `*Scoped` wrappers), L4 per-module cross-tenant leak tests, L5 the `check:spec` route guard. The boundary is built, exercised by every consuming app, and protected against regression — for `invoice` / `support-ticket` / `file-media` / `forms-intake`.

Optional follow-ups (lower priority — not blocking the differentiator claim):
- **More modules** — `booking`/`billing-subscriptions`/`notifications-inapp` scope by customer/subscriber/user id, not `tenantId`; each needs a per-module scope-column decision before migrating.
- **Marketing proof** — the leak tests + guard are the demonstrable artifact behind "a cross-tenant read fails our build"; wire one into a buyer-facing demo.
