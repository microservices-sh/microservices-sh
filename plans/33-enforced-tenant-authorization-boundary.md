# Plan 33 — Enforced tenant/actor authorization boundary (P0 linchpin)

**Status:** spec — review before the cross-module refactor (steps 2–4 below).

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
1. Land `AuthContext` + `ScopedStore` + `tenantScoped()` helper (additive, no behavior change).
2. Migrate **`customer`** end-to-end as the reference module; add its leak-test.
3. Roll module-by-module: `invoice`, `booking`, `support-ticket`, `file-media`, `forms-intake`, `billing-subscriptions`, `notifications-inapp` — each with a leak-test.
4. Enable the L5 lint guard once all scoped tables route through the scoped store.

## Done =
- A scoped module's data access is **uncallable without `AuthContext`** (compile error otherwise).
- `check:spec` runs a cross-tenant leak test **per scoped table**; red on any leak.
- The pitch line above is literally true and demonstrable.

## Risk / limits (be honest)
- **D1/SQLite has no native RLS** (unlike Postgres) → enforcement is app-layer (L2–L3) + CI (L4–L5). The DB engine will not save you.
- Strength = "all access goes through the scoped store"; L5 is what guards the perimeter.
- **DO-per-tenant** (each tenant = its own Durable Object SQLite) is the *physical*-isolation option for high-assurance cases — reserved, since it loses easy cross-tenant queries and adds complexity.

## ⚑ Checkpoint
Steps 1 is safe/additive. **Steps 2–4 are a cross-module refactor — review this design before they land.** Each step is independently shippable and must keep `pnpm -r build`, `pnpm test`, and `pnpm spec:check:all` green.
