# Dogfooding microservices.sh on its own admin

*2026-06-19. Engineering writeup. Honest by design — it credits what stayed bespoke and what's still pending.*

## Why
microservices.sh sells composable, source-visible modules but ran its own platform — admin and api — on entirely bespoke code (no `@microservices-sh/*` modules imported anywhere). For a product whose pitch is "use our modules," that's a credibility gap. So we set out to **run part of our own admin on our own modules** — to (a) prove it, and (b) surface the gaps only a real user hits.

This is the result of the first pass. It is deliberately partial and honest about its boundaries.

## What we changed

### 1. A real module-distribution path (Phase 0)
`api/` is a separate repo from the monorepo where modules live, and `admin-shell` shipped as raw `.ts` with an internal `workspace:*` dependency — so a plain `file:` dependency dangled. The fix: an esbuild build that bundles a module into a **self-contained artifact** (inlining `connection-contract` + `zod`), packed as a tarball the separate repo consumes.

**Finding:** consuming a module *outside* the monorepo isn't frictionless today — exactly what an external/private-module consumer would hit. Now there's a working build→pack→consume path. (Commits: monorepo `68425ca`, `dc80fdf`; api `52d1dd4`.)

### 2. Extracted `passkey-auth` into a published module
Our admin's WebAuthn/passkey login was ~300 lines of bespoke code in `api/src/passkey.ts`. We **extracted and re-shaped** it into a real module — `modules/passkey-auth` (946 LOC source, 535 LOC tests, 33 passing tests) — mirroring the `identity` module's ports/adapters/use-cases shape.

Re-shaped, not copied: the module returns a **verified `userId`** and the host mints the session (clean boundary), and the WebAuthn library is behind an injectable seam so it's unit-testable without real attestation crypto. It's now an indexable public catalog page. (Commits: `01dd71a`, `f7dc13b`; catalog `527649f`.)

### 3. Migrated the `users` admin reads onto `admin-shell` — and the dogfood improved the product
This is the point. The api's `users` admin list/detail were bespoke handlers. We moved them onto the `admin-shell` module (`listRecords`/`getRecord` over a D1 `TableGateway`, behind a registry definition).

**Using our own module surfaced a real gap:** `admin-shell`'s gateway only did `SELECT <cols> FROM <one table>` — it couldn't express the `workspace_count` correlated subquery the users list needs. Instead of working around it, we **added a SQL-safe computed-column capability to `admin-shell`** (+145 LOC, 5 new tests): developer-authored read-only SQL expressions in the registry definition, excluded from writes/filters/sort, with the existing identifier-validation model intact (audited — no user-input-to-SQL path).

The api handler went from a hand-rolled query to a registry definition + a thin route (`admin.ts` −18/+39); module tests 15/15, full api suite 107/107, response shape preserved (one additive `total` field). (Commits: monorepo `0cec11f`; api `bbb30ec`.)

**That's the headline: we used our own product, it wasn't enough, so we made the product better — and every future consumer gets the computed-column capability.**

We then migrated **`workspaces` and `tickets` list reads** the same way (commit `5ad8957`): joined columns (`owner_email`, `plan_id`/`billing_status` with COALESCE defaults, `member_count` excluding removed members, `deployment_count`, `workspace_name`) reproduced as correlated computed subqueries; the tickets `status` filter via admin-shell's normal column filter. SQL parity verified exactly against the deleted queries; 115 api tests green. **So all three admin LIST reads (users/workspaces/tickets) now run on `admin-shell`.**

### Gaps the dogfood surfaced — ALL FOUR now closed (the real payoff: using our product drove four module improvements)
- ✅ **has-many on `getRecord`** (monorepo `14434d1`, api `8d93fd2`): added `ResourceDefinition.relations` + a `listRelated` gateway method (SQL-safe: identifiers validated, `where`/computed from trusted registry only, `parentId` bound). **Workspaces *detail* now also runs on admin-shell** — `{ workspace, members, apiKeys, deployments }`, byte-parity-verified against the deleted bespoke handler.
- ✅ **search across joined columns** (monorepo `c3ce7f2`, api `b330794`): `searchable` may name a computed column → `(<expression>) LIKE ?`. Workspaces owner-email search restored.
- ✅ **page-size parity** (api `f510373`): pass `config:{ maxPageSize:200 }`; restored the old 200 cap.
- ✅ **no shipped types** (monorepo `f5fa742`, api `72a8db8`): self-contained bundled `.d.ts` via `dts-bundle-generator`; api TS7016 3→0 — benefits every external consumer.

Every fix was test-first and reviewed (incl. a dedicated SQL-injection audit on the relation/search SQL). admin-shell 23/23, api 123/123, types clean.

## What we deliberately did NOT change (and why)
Honesty matters more than a bigger claim:
- **Deployment / control-plane orchestration, Cloudflare OAuth, Stripe billing sync** — state-machine + external-API orchestration, not CRUD. They don't belong in `admin-shell` and weren't forced into it.
- **Domain operations** (`setUserDisabled`, `setPlan`, `revokeKey`, ticket status) — these are actions, not generic CRUD; they stay bespoke endpoints.
- **Passkey session minting** — kept in the host, by design.
- **`research` / `decision` / `ai-gateway`** — draft scaffolds; not shipped, not marketed.

## The honest claim
Not "microservices.sh runs entirely on its own modules / on the CLI." It's: **every admin read — the users/workspaces/tickets lists AND the workspaces detail — plus passkey auth now run on our own modules; using them drove four shipped module improvements (computed columns, has-many relations, searchable computed columns, bundled types); the orchestration internals (deploy/Stripe/Cloudflare) and domain action endpoints remain bespoke, on purpose.**

## Status
All committed locally on `main` in both repos; **not yet pushed or deployed** (gated). Reviewed at each step (spec + code-quality + a dedicated SQL-injection audit on the computed-column feature).

## Next
- **Ship it** (makes the claim live-true): push monorepo + api, `wrangler deploy` the api, then publish the case-study post. Currently all committed locally; nothing deployed.
- Optional: forward admin-shell audit → `audit_events` once a *mutation* moves onto the module (reads don't audit); migrate users/tickets *detail* onto relations if useful; publish `passkey-auth` to npm when name/version approved.
