# Dogfood Admin on Our Own Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make microservices.sh run its own admin on its own modules — build a public `passkey-auth` module (extracted from the live admin) and replace the bespoke `api/src/admin-resources.ts` CRUD/audit framework with the real `@microservices-sh/admin-shell` module — to produce the flagship "we run on our own product" proof and surface real module gaps.

**Architecture:** Two independently-shippable subsystems. (A) A new `passkey-auth` module in the monorepo (`microservices-sh/modules/passkey-auth`), mirroring the `identity` module's ports/adapters/use-cases shape, wrapping `@simplewebauthn/server`. (B) A strangler migration of the `api/` worker's admin CRUD (users → workspaces → tickets) from the hand-rolled `admin-resources` registry onto `admin-shell`'s `createResourceRegistry` + `listRecords/getRecord/...` over a D1 `TableGateway`, with audit forwarded to the existing `audit_events` table. Bespoke orchestration (deployments/control-plane, Cloudflare OAuth, Stripe sync) and domain ops (disable/setPlan/revokeKey) stay out of scope.

**Tech Stack:** TypeScript, Cloudflare Workers + D1, Hono (api), SvelteKit (admin frontend), Vitest, `@simplewebauthn/server`, the monorepo module system (`module.json`, `microservices.check.mjs`, `@microservices-sh/connection-contract`).

---

## Scope

**In scope**
- **Subsystem A — `passkey-auth` module** (public, catalog): registration + authentication ceremonies + credential management, D1 + memory adapters, TDD, passes `microservices.check`, listed in the registry.
- **Subsystem B — admin-shell dogfood in `api/`**: replace the bespoke list/get/search/pagination/audit for `users`, `workspaces`, `platform_support_tickets` with `@microservices-sh/admin-shell`. Strangler, one resource at a time.
- **Subsystem C — proof**: wire admin-shell audit → `audit_events`; write the case-study doc + the registry/llms updates.

**Out of scope (explicit — do NOT modularize)**
- Deployment/control-plane orchestration (`api/src/control-plane.ts`), Cloudflare OAuth (`cloudflare-connections.ts`), Stripe billing sync (`api/src/billing/`), observability ingestion. These are state-machine/external-API orchestration, not CRUD.
- Domain ops beyond CRUD (`setUserDisabled`, `setPlan`, `revokeKey`, `setTicketStatus`) — keep as bespoke endpoints; admin-shell owns generic list/get/create/update/delete only. (A later phase may model them as admin-shell custom actions, not now.)
- Passkeys are NOT replaced by `identity` (email-code) — passkey-auth is a distinct module.

**Two-subsystem note:** A and B are independently shippable. If executed separately, treat each `##` Subsystem as its own plan. Phase 0 is shared.

---

## File Structure

**New module (monorepo):** `microservices-sh/modules/passkey-auth/` — mirrors `modules/identity/` layout: `module.json`, `package.json`, `microservices.check.mjs`, `migrations/0001_passkey_auth.sql`, `schemas/*.json`, `src/{index,types,schemas,rpc,meta}.ts`, `src/manifest/index.ts`, `src/config/index.ts`, `src/permissions/index.ts`, `src/resources/index.ts`, `src/events/index.ts`, `src/ports/index.ts`, `src/adapters/{d1-passkey-store,memory-passkey-store}.ts`, `src/use-cases/{begin-registration,verify-registration,begin-authentication,verify-authentication,list-credentials,delete-credential}.ts`, `tests/unit/*.test.ts`.

**api/ integration (separate repo):** modify `api/src/admin.ts` (mount), replace usage in `api/src/admin-resources.ts` (or a new `api/src/admin-shell-registry.ts`), add `api/src/lib/admin-actor.ts`. Tests in `api/test/`.

**Reference (read, do not edit):** `modules/identity/`, `modules/customer/`, `modules/admin-shell/`, `modules/auth/`, `packages/connection-contract/`, `templates/saas-starter-sveltekit/src/lib/server/admin-registry.ts`.

---

## Phase 0 — Foundations & distribution spike (shared)

Resolves the cross-repo question before any feature work: **how does the `api/` worker consume a monorepo module?** (modules are unpublished today.)

### Task 0.1: Decide + wire the module-consumption path for `api/`
**Files:** `api/package.json`, repo workspace config.
- [ ] **Step 1:** Determine how `api/` will import `@microservices-sh/admin-shell` and `@microservices-sh/connection-contract`. Options, in order of preference: (a) pnpm workspace/`file:` path dependency to the monorepo build; (b) `npm pack` tarball vendored into `api/`; (c) publish the module to npm. Document the choice at the top of `api/src/admin-shell-registry.ts` as a comment.
- [ ] **Step 2:** Confirm `admin-shell` ships consumable entry points: `@microservices-sh/admin-shell` (registry + use-cases) and `@microservices-sh/admin-shell/adapters/d1`. Verify in `modules/admin-shell/package.json` `exports`. If missing, add the subpath export (separate trivial commit in the monorepo).
- [ ] **Step 3:** Add the dependency to `api/package.json`; run install; write a throwaway `api/test/smoke-admin-shell.test.ts` that imports `createResourceRegistry` and `createMemoryTableGateway` and asserts they're functions.
- [ ] **Step 4:** Run `pnpm -C api test smoke-admin-shell` — expect PASS (proves the cross-repo import resolves).
- [ ] **Step 5:** Commit. `chore(api): wire @microservices-sh/admin-shell consumption (dogfood foundation)`

> ⚠️ If no consumption path works without significant infra, STOP and surface to human — this is the make-or-break dependency. The honest fallback is to publish admin-shell to npm first (a one-time real step that also advances distribution).

### Task 0.2: Confirm admin-shell capability vs api's real schema
**Files:** none (read-only verification) → notes in the plan's tracking.
- [ ] **Step 1:** Diff the `users`/`workspaces`/`platform_support_tickets` columns in `api/schema.sql` against `ResourceDefinition.ColumnDef` types. List any column type that admin-shell can't express (json/datetime handling).
- [ ] **Step 2:** Confirm `admin-shell`'s `softDelete` supports the admin's pattern (`disabled_at` is a nullable timestamp, not a boolean) — note whether soft-delete maps or whether disable stays a bespoke op (it does — disable is a domain op, out of scope).
- [ ] **Step 3:** Record findings as a short comment block in `api/src/admin-shell-registry.ts` (created in Phase 2). No commit needed beyond Phase 2.

---

## Subsystem A — `passkey-auth` module

Mirror `modules/identity` exactly. Source of truth for behavior: `api/src/passkey.ts` (the working implementation to extract). Test-first with the **memory adapter**, then D1.

### Task A.1: Scaffold module + manifest + check (red)
**Files:** Create `modules/passkey-auth/{module.json,package.json,microservices.check.mjs}`, `src/manifest/index.ts`, `src/index.ts`.
- [ ] **Step 1:** Copy the file skeleton from `modules/identity/` (structure only). Write `module.json` with `id: "passkey-auth"`, `class: "core"`, `status: "available"`, `permissions: ["passkey.register","passkey.authenticate","passkey.admin"]`, `connections.requires: []`, `connections.optional: ["identity","auth","audit-log"]`, `rpc.exposes` for the 6 use-cases, `events.emits: ["passkey.registered","passkey.authenticated","passkey.credential_deleted"]`. Mirror the `module.json` shape from `modules/customer/module.json`.
- [ ] **Step 2:** Write `microservices.check.mjs` asserting the migration creates `passkey_credentials` + `passkey_challenges`, and that `src/use-cases/verify-authentication.ts` includes counter/replay handling (`assertFileIncludes(... "counter" ...)`).
- [ ] **Step 3:** Run the contract check (`node modules/passkey-auth/microservices.check.mjs` via the repo's check runner). Expected: FAIL (files absent).
- [ ] **Step 4:** Commit. `feat(passkey-auth): scaffold module manifest + contract check`

### Task A.2: Types, schemas, ports
**Files:** `src/types.ts`, `src/schemas.ts`, `src/ports/index.ts`.
- [ ] **Step 1:** Define `PasskeyCredential`, `PasskeyChallenge` types matching `api`'s `passkey_credentials`/`passkey_challenges` columns (credential_id, public_key, counter, transports, device_type, backed_up, last_used_at; challenge_key, challenge, user_id, expires_at).
- [ ] **Step 2:** Define `PasskeyStore` port: `putChallenge`, `getChallenge`, `deleteChallenge`, `saveCredential`, `getCredentialsByUser`, `getCredentialById`, `updateCounter`, `deleteCredential` (mirror identity's port style; signatures from research Section 8).
- [ ] **Step 3:** Zod schemas for the 6 use-case inputs in `src/schemas.ts`.
- [ ] **Step 4:** Commit. `feat(passkey-auth): types, zod schemas, PasskeyStore port`

### Task A.3: Memory adapter + first use-case (begin-registration), TDD
**Files:** `src/adapters/memory-passkey-store.ts`, `src/use-cases/begin-registration.ts`, `tests/unit/begin-registration.test.ts`.
- [ ] **Step 1 (red):** Write `tests/unit/begin-registration.test.ts`: with a memory store, `beginRegistration({ userId }, { passkeyStore, rpId, rpName })` returns `ok(200, {...options, challengeKey})` and persists a challenge retrievable by `getChallenge`.
- [ ] **Step 2:** Run `pnpm -C modules/passkey-auth test begin-registration` → FAIL.
- [ ] **Step 3 (green):** Implement `createMemoryPasskeyStore()` (Maps) and `beginRegistration` using `@simplewebauthn/server` `generateRegistrationOptions` + `err`/`ok` from `@microservices-sh/connection-contract`. Port logic from `api/src/passkey.ts` `generateRegOptions` (lines ~108-132).
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit. `feat(passkey-auth): begin-registration use-case + memory adapter (TDD)`

### Task A.4: verify-registration (TDD)
**Files:** `src/use-cases/verify-registration.ts`, `tests/unit/verify-registration.test.ts`.
- [ ] **Step 1 (red):** Test: given a stored challenge + a (mocked) attestation, `verifyRegistration` saves a credential (counter 0) and emits `passkey.registered`; rejects when challenge missing/expired.
- [ ] **Step 2:** Run → FAIL. **Step 3 (green):** Implement, porting `verifyRegResponse` (api passkey.ts ~134-185), wrapping `verifyRegistrationResponse`. Mock the verify call in tests (don't do real WebAuthn crypto in unit tests; isolate the ceremony lib behind a thin injectable `verify` dep). **Step 4:** PASS. **Step 5:** Commit.

### Task A.5: begin-authentication + verify-authentication (TDD)
**Files:** `src/use-cases/{begin-authentication,verify-authentication}.ts`, tests.
- [ ] **Step 1 (red):** Tests: begin-auth returns options + challengeKey (optionally scoped to a user's credentials); verify-auth checks the stored challenge, verifies the assertion (injected `verify` dep), enforces the **counter is strictly greater** (replay protection), bumps `counter` + `last_used_at`, emits `passkey.authenticated`, and returns the verified `userId` (session creation is the host's job — return userId, do NOT create sessions in the module). Reject on counter regression / expired challenge / unknown credential.
- [ ] **Steps 2-4:** Red → implement (port `generateLoginOptions`/`verifyLoginResponse`, api passkey.ts ~189-280, minus `createSession` — that stays in the host) → green.
- [ ] **Step 5:** Commit.

### Task A.6: list-credentials + delete-credential (TDD)
**Files:** `src/use-cases/{list-credentials,delete-credential}.ts`, tests.
- [ ] Red → green → commit. List returns a user's credentials (no secrets beyond what's needed); delete removes by id scoped to the owning user; emits `passkey.credential_deleted`.

### Task A.7: D1 adapter (TDD against the contract)
**Files:** `src/adapters/d1-passkey-store.ts`, `migrations/0001_passkey_auth.sql`, `tests/unit/d1-passkey-store.test.ts`.
- [ ] **Step 1:** Write `migrations/0001_passkey_auth.sql` for `passkey_credentials` + `passkey_challenges` (copy column defs from `api/migrations/0007_passkeys.sql` so the module owns the canonical schema).
- [ ] **Step 2 (red):** Reuse the memory-adapter test suite as a shared contract test run against a D1 test harness (Vitest + `@cloudflare/vitest-pool-workers` or the repo's existing D1 test util — match how `modules/identity/tests` test the d1 adapter).
- [ ] **Steps 3-4:** Implement `createD1PasskeyStore(db)` → PASS the shared contract suite.
- [ ] **Step 5:** Commit.

### Task A.8: RPC contract, exports, config, permissions, events
**Files:** `src/rpc.ts`, `src/index.ts`, `src/config/index.ts`, `src/permissions/index.ts`, `src/events/index.ts`, `src/resources/index.ts`.
- [ ] **Step 1:** `src/rpc.ts` exporting `rpcContract` for the 6 methods with scopes (`passkey.register`/`passkey.authenticate`/`passkey.admin`, `public` flags) — mirror `modules/auth/src/rpc.ts`.
- [ ] **Step 2:** `src/index.ts` re-exports (mirror `modules/customer/src/index.ts`). Config schema (rpId, rpName, origin, timeout, attestation). Permissions + events arrays.
- [ ] **Step 3:** Run `microservices.check.mjs` for passkey-auth → PASS. Run full module test suite → PASS.
- [ ] **Step 4:** Commit. `feat(passkey-auth): rpc contract + module exports; check passes`

### Task A.9: Register in catalog + publish-readiness (the "publish, no harm" step)
**Files:** monorepo registry build + `landing-page` registry sync; `package.json` publish config.
- [ ] **Step 1:** Run the monorepo `registry build` so `passkey-auth` enters the generated catalog; confirm maturity renders correctly (start at `experimental`/beta — honest).
- [ ] **Step 2:** `cd landing-page && node scripts/sync-registry.mjs`; confirm `/modules/passkey-auth` builds; verify it is NOT roadmap-noindexed (it's available).
- [ ] **Step 3:** Add to `landing-page/public/llms.txt` Access & identity line (passkey-auth). Add an `auth0-alternative`/passkey cross-link if relevant.
- [ ] **Step 4:** Commit (monorepo) + commit (landing-page). Do NOT publish to npm until a human approves the package name/version (a published module is a promise — see truth guardrail).

---

## Subsystem B — admin-shell dogfood in `api/` (strangler)

Replace the bespoke registry for ONE resource at a time. Each task keeps the existing endpoint contract (same JSON shape the admin frontend consumes) so the SvelteKit app needs no change.

### Task B.1: Mount admin-shell + AdminActor in `api/`
**Files:** Create `api/src/admin-shell-registry.ts`, `api/src/lib/admin-actor.ts`; modify `api/src/admin.ts`.
- [ ] **Step 1 (red):** `api/test/admin-actor.test.ts`: `toAdminActor(staffContext)` returns `{ id, permissions: ["*"] }` for staff, and throws/returns null for non-staff. (Mirror the existing `resolveStaff()` gate in `api/src/admin.ts` ~175-227.)
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `toAdminActor`. **Step 4:** PASS. **Step 5:** Commit.
- [ ] **Step 6:** Create `api/src/admin-shell-registry.ts` with `createResourceRegistry([...])` defining the `users` resource only (columns from `api/schema.sql`: id, email, name, created_at, updated_at, last_login_at, is_staff; `searchable: ["email","name"]`; `permissions: { read: "admin.read", write: "admin.write" }`; `defaultSort` created_at desc). Commit. `feat(api): admin-shell registry (users) + AdminActor`

### Task B.2: Migrate `users` list/get to admin-shell (TDD, strangler)
**Files:** modify `api/src/admin.ts` (the users list/detail handlers), `api/test/admin-users.test.ts`.
- [ ] **Step 1 (red):** Test the users list endpoint via `admin-shell`'s `listRecords(registry, "users", query, { gateway: createMemoryTableGateway(seed), actor, audit })` returns the same envelope shape (items + total + pagination) the admin frontend expects (compare to current `serverApi.admin.users` response).
- [ ] **Step 2:** Run → FAIL. **Step 3 (green):** Replace the bespoke users list/detail in `admin.ts` with `listRecords`/`getRecord` over `createD1TableGateway(c.env.DB)`. Keep the route path + response shape identical. Leave `setUserDisabled` (domain op) untouched.
- [ ] **Step 4:** Run → PASS. Manually diff response JSON against the old shape (add a snapshot test).
- [ ] **Step 5:** Commit. `feat(api): users admin list/get on admin-shell (dogfood); delete bespoke path`
- [ ] **Step 6:** Verify the admin frontend `/users` page still renders against a local api (no frontend change expected).

### Task B.3: Migrate `workspaces` list/get (TDD)
**Files:** `api/src/admin-shell-registry.ts` (+workspaces resource), `api/src/admin.ts`, `api/test/admin-workspaces.test.ts`.
- [ ] Red (envelope-parity test) → add workspaces ResourceDefinition → replace bespoke list/detail with admin-shell → green → commit. Keep `setPlan`/`toggleDisabled`/`revokeKey` bespoke.

### Task B.4: Migrate `platform_support_tickets` list/get (TDD)
**Files:** registry (+tickets resource, status filter via admin-shell filters), `api/src/admin.ts`, test.
- [ ] Red → implement (map the status filter to admin-shell's filter support) → green → commit. Keep `setTicketStatus` bespoke.

### Task B.5: Forward admin-shell audit → `audit_events` (TDD)
**Files:** `api/src/admin-shell-registry.ts` (wire the `audit` dep / `onAdminAction`), `api/test/admin-audit.test.ts`.
- [ ] **Step 1 (red):** Test: a create/update/delete through admin-shell calls the `audit` dep, which writes an `audit_events` row (action, target_type, target_id, actor_user_id) — matching the format `writeAudit()` produced.
- [ ] **Steps 2-4:** Implement an `audit` adapter that writes to `audit_events` (reuse the existing `writeAudit` from `api/src/admin.ts`); pass it into the admin-shell use-case deps. PASS.
- [ ] **Step 5:** Commit. `feat(api): forward admin-shell audit to audit_events`

### Task B.6: Delete the dead bespoke registry code
**Files:** `api/src/admin-resources.ts` (remove the now-unused list/get framework paths for the 3 migrated resources).
- [ ] **Step 1:** Remove the superseded bespoke list/get/search/pagination code for users/workspaces/tickets (keep the ops framework for the remaining domain ops). Run the full `api` test suite → PASS.
- [ ] **Step 2:** Commit. `refactor(api): delete bespoke admin CRUD replaced by admin-shell module` — *(this is the money commit for the case study: lines of bespoke code deleted in favor of our own module.)*

---

## Subsystem C — proof + honesty

### Task C.1: Capture the case study
**Files:** Create `microservices-sh/docs/dogfood-admin.md` (engineering writeup) + a landing-page blog draft (CMS draft, not published).
- [ ] **Step 1:** Write the engineering doc: what migrated to modules (users/workspaces/tickets CRUD + audit via admin-shell; passkey-auth extracted + published), what stayed bespoke and **why** (deployments/control-plane, Cloudflare OAuth, Stripe sync, domain ops), and the metric (bespoke LOC deleted; modules now dogfooded).
- [ ] **Step 2:** Draft a FavCRM CMS blog post (status: **draft**, per the cadence mechanism) — title e.g. "We replaced our admin's CRUD with our own module. Here's the PR." Honest framing: CRUD core on our modules; orchestration stays bespoke.
- [ ] **Step 3:** Update `.agents/product-marketing.md` Proof Points: "admin CRUD + passkey now run on our own modules (dogfooded)." Commit (note: `.agents`/root is unversioned — save the doc in the monorepo).

### Task C.2: Update positioning truth
- [ ] Ensure no overclaim: the proof is "our admin's CRUD core + passkey run on our own modules," NOT "our whole platform runs on the CLI." Record in memory `corporate-os-positioning` + the strategic thesis.

---

## Risks & honesty guardrails
- **Cross-repo distribution (Phase 0) is the gating risk.** If `api/` can't consume the module cleanly, publishing admin-shell to npm first is the honest unblock (and advances the real distribution path). Don't fake it with copy-paste — that defeats the dogfood.
- **admin-shell may not express everything** (json columns, the `disabled_at` soft-delete-as-domain-op). Expected — capture gaps as product feedback (the point of dogfooding); don't force non-CRUD into admin-shell.
- **WebAuthn crypto in tests:** isolate `@simplewebauthn/server` verify calls behind an injectable dep; unit tests assert orchestration (challenge lifecycle, counter/replay, persistence), not real attestation crypto.
- **Truth guardrail:** passkey-auth ships at honest maturity (beta); the case study credits what stayed bespoke. No "100% built on the CLI" claim.
- **Sessions stay in the host:** the passkey-auth module returns a verified `userId`; it does NOT mint sessions (that's the api's `createSession`). Keeps the module portable + honest about boundaries.

---

## Execution note
Subsystem A (passkey-auth module) and Subsystem B (admin-shell dogfood) are independent after Phase 0 — A can ship to the catalog without B, and B proves the dogfood without A. Recommended order: **Phase 0 → A (greenfield, clean TDD, ships a public module) → B (strangler, the deletion + proof) → C (case study).**
