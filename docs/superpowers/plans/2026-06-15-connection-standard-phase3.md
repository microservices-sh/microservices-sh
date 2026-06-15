# Module Connection Standard — Phase 3 (Connector + Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the runtime wiring (RPC clients/entrypoints, event routing table, ordered hook maps) from `compose()`'s `wiring.json`, prove it with a both-topology pool-workers e2e suite, migrate the remaining 16 modules to `connections`, and remove the Phase-2 transitional shims.

**Architecture:** The composer (Phase 2) already emits a validated `wiring.json`. Phase 3 adds **codegen** that turns that wiring into deployable artifacts: per-module `WorkerEntrypoint` + typed client (extend `packages/sdk-internal/src/rpc-codegen.js`), a generated `eventName → [consumers]` routing table feeding a thin queue consumer, and a generated `hookPoint → ordered chain` map consumed by `runHooks` at runtime. Then every module is migrated to the `connections` block and the temporary flat-field fallbacks are deleted.

**Tech Stack:** pnpm 10 workspace, `vitest` ^3.2.4, `@cloudflare/vitest-pool-workers` (Miniflare: Workers + D1 + Queues + service bindings), `zod`, the `@microservices-sh/connection-contract` package (Phase 2).

**Spec:** `plans/25-module-connection-standard.md`. **Builds on:** `docs/superpowers/plans/2026-06-15-connection-standard-phase2.md` (done — package + composer + auth/payment migrated, 162 tests green).

**⚠️ Concurrency:** a parallel `cc` worker is active on branch `plan-25-connection-standard` editing modules/templates. The 16-module migration (sub-phase 3C) WILL collide. Run 3C in an isolated git worktree (superpowers:using-git-worktrees) OR coordinate ownership per module. Sub-phases 3A/3B/3D touch the package + codegen + one new test dir and are low-collision.

---

## Scope note / sub-phase breakdown

Phase 3 is large; it is four sub-phases, each independently testable:

- **3A Codegen + runtime** (sequential foundation) — Tasks 1–6
- **3B Both-topology e2e** (after 3A) — Tasks 7–9
- **3C Migrate remaining 16 modules** (parallelizable; needs 3A only for service-mode tests) — Task 10 (templated, one subagent per module)
- **3D Remove shims + finish** (after 3C) — Tasks 11–14

If executing with subagents, 3C is the fan-out; 3A/3B/3D are serial.

---

## File Structure

**Codegen (extend existing):**
- `packages/sdk-internal/src/rpc-codegen.js` — currently reads flat `module.rpc` + hardcodes `SERVICE_SPECS`. Change to read `connections.rpc.exposes`; derive `verify` mode (`auth` ⇒ self, all else ⇒ binding) instead of a hardcoded table.
- `packages/sdk-internal/src/event-codegen.js` *(new)* — `generateEventRouter(wiring)` → `eventName → [{module, handler}]` table + a queue-consumer entry that verifies the signed envelope and dispatches.
- `packages/sdk-internal/src/hook-codegen.js` *(new)* — `generateHookMap(wiring)` → `hookPoint → ordered [{module, handler, kind, order}]`, importable by the producing module's use case to feed `runHooks`.

**Runtime (thin, in the contract package):**
- `packages/connection-contract/src/runtime/event-consumer.js` *(new)* — `handleQueueBatch(batch, { routes, secret })`: verify envelope, dispatch to consumers, ack.
- (hook runtime already exists: `runHooks`.)

**Composer surface:**
- `packages/connection-contract/src/composer/emit.js` *(new)* — `emitArtifacts(wiring, outDir)`: write `wiring.json` + generated files; the single entry the CLI/build calls.

**E2E:**
- `tests/e2e/vitest.e2e.config.js`, `tests/e2e/fixtures/compose-app.js` (embedded + service boot), `tests/e2e/helpers/flush-queues.js`, `tests/e2e/scenarios.test.js`.

**CLI:**
- `packages/cli/src/**` — add `microservices graph` (render resolved honeycomb from `compose()`).

**Migration (3C), per module under `modules/<id>/`:**
- `module.json` (flat → `connections`), use-cases (envelope + meta where cross-module), `tests/connections.test.ts`. ⚠️ `email` also at `modules/modules/email` (dual tree — migrate both, keep byte-identical).

**Cleanup (3D):**
- `packages/workspace-tools/src/index.js` — remove `// TODO(phase3)` flat fallbacks.
- `packages/module-contract/src/index.{js,d.ts}` — reshape internal `MODULES` to `connections`; derive any remaining flat consumers (`composeApp`, `createModuleLock`).

---

## Sub-phase 3A — Codegen + runtime

### Task 1: rpc-codegen reads `connections.rpc.exposes`

**Files:**
- Modify: `packages/sdk-internal/src/rpc-codegen.js`
- Test: `packages/sdk-internal/tests/rpc-codegen.test.js`

- [ ] **Step 1: Write failing test** — `rpcMethods({ id:"payment", connections:{ rpc:{ exposes:[{method:"createPaymentIntent",scope:"payment.write",public:false}] } } })` returns the exposed methods; `generateRpcEntrypoint` emits a `PaymentService extends WorkerEntrypoint` with a `createPaymentIntent` method and a scope check for `payment.write`.
- [ ] **Step 2: Run** → FAIL (today `rpcMethods` reads flat `module.rpc`).
- [ ] **Step 3: Implement** — `rpcMethods` reads `module.connections?.rpc?.exposes ?? module.rpc ?? []` (fallback during 3C). Replace the hardcoded `SERVICE_SPECS` verify table with: `verify = module.id === "auth" ? "self" : "binding"`; `pkg = "@microservices-sh/" + module.id`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(codegen): rpc entrypoint/client from connections.rpc`

### Task 2: rpc client targets from `connections.rpc.calls`

**Files:**
- Modify: `packages/sdk-internal/src/rpc-codegen.js`
- Test: same test file

- [ ] **Step 1: Write failing test** — `generateRpcClient` for a caller declaring `rpc.calls:[{target:"auth.verifyToken",scope:"auth.verify"}]` emits a typed accessor that resolves the `auth` service binding and calls `verifyToken` with the caller token.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the calls→client mapping. **Step 4: Run** → PASS. **Step 5: Commit** `feat(codegen): typed rpc clients from connections.rpc.calls`

### Task 3: event routing table codegen

**Files:**
- Create: `packages/sdk-internal/src/event-codegen.js`, `.d.ts`
- Test: `packages/sdk-internal/tests/event-codegen.test.js`

- [ ] **Step 1: Write failing test** — `generateEventRouter(wiring)` where `wiring.events=[{event:"payment.succeeded",from:"payment",to:"booking"},{...to:"audit-log"}]` returns `{ "payment.succeeded": [{module:"booking"}, {module:"audit-log"}] }` and emits importable router code.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `generateEventRouter`. **Step 4: Run** → PASS. **Step 5: Commit** `feat(codegen): event routing table`

### Task 4: hook map codegen

**Files:**
- Create: `packages/sdk-internal/src/hook-codegen.js`, `.d.ts`
- Test: `packages/sdk-internal/tests/hook-codegen.test.js`

- [ ] **Step 1: Write failing test** — `generateHookMap(wiring)` where `wiring.hooks={"payment.beforeCreatePaymentIntent":[{registrant:"booking",handler:"src/hooks/x.ts",order:50,...}]}` emits an ordered chain map keyed by hook point, each entry referencing `{kind, order, fn-import}`. Order is preserved.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (kind comes from the target module's `hookPoints[point].kind`). **Step 4: Run** → PASS. **Step 5: Commit** `feat(codegen): ordered hook map`

### Task 5: runtime queue event consumer

**Files:**
- Create: `packages/connection-contract/src/runtime/event-consumer.js`, `.d.ts`
- Test: `packages/connection-contract/tests/runtime/event-consumer.test.js`

- [ ] **Step 1: Write failing test** — `handleQueueBatch([{body: signedEnvelope}], { routes, secret, dispatch })`: verifies each envelope (reject unsigned/tampered), looks up `routes[eventName]`, calls `dispatch(module, envelope)` per consumer, returns `{acked, rejected}`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** using `verifyEnvelope` from the package. **Step 4: Run** → PASS. **Step 5: Commit** `feat(runtime): signed queue event consumer`

### Task 6: composer artifact emitter

**Files:**
- Create: `packages/connection-contract/src/composer/emit.js`, `.d.ts`
- Test: `packages/connection-contract/tests/composer/emit.test.js`

- [ ] **Step 1: Write failing test** — `emitArtifacts(wiring, fs-spy)` writes `wiring.json` + invokes the three codegens (rpc/event/hook) and returns the set of generated file paths; given an `{ok:false}` compose result it writes nothing and throws.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (thin orchestration over Tasks 1–4; inject the fs writer so it is testable without disk). **Step 4: Run** → PASS. **Step 5: Commit** `feat(composer): artifact emitter`

---

## Sub-phase 3B — Both-topology e2e

### Task 7: pool-workers harness + fixtures

**Files:**
- Create: `tests/e2e/vitest.e2e.config.js` (`@cloudflare/vitest-pool-workers`, D1 + Queues + service bindings)
- Create: `tests/e2e/fixtures/compose-app.js` (run real `compose()` + `emitArtifacts`, boot embedded AND service)
- Create: `tests/e2e/helpers/flush-queues.js`
- Modify: root `package.json` → `"test:e2e": "vitest run -c tests/e2e/vitest.e2e.config.js"`

- [ ] **Step 1:** Add dev dep `@cloudflare/vitest-pool-workers`; write the config.
- [ ] **Step 2:** `flushQueues()` deterministic Miniflare drain (no sleeps).
- [ ] **Step 3:** `compose-app.js` boots the 5-module fixture `[auth, customer, payment, booking, audit-log]` in both `embedded` and `service` modes from generated artifacts.
- [ ] **Step 4: Commit** `test(e2e): pool-workers harness + both-topology boot`

### Task 8: scenarios 1–5 (both topologies)

**Files:** `tests/e2e/scenarios.test.js` — `describe.each(["embedded","service"])`

- [ ] **Step 1–5:** Implement spec §10 scenarios 1–5 (RPC happy, RPC auth-gate 403/401, event fan-out + tamper-reject via `flushQueues`, hook filter+veto, correlationId across all hops incl. audit-log row). Run `pnpm test:e2e` until green in both modes. Commit.

### Task 9: scenarios 6–7 (parity + pipeline)

- [ ] **Step 1:** Scenario 6 — diff embedded vs service results for 1–5 (identical modulo `requestId`/latency).
- [ ] **Step 2:** Scenario 7 — start from raw module set → real `compose()` → `emitArtifacts` → boot → hit it (catches codegen drift).
- [ ] **Step 3: Commit** `test(e2e): topology parity + composer→runtime pipeline`

---

## Sub-phase 3C — Migrate the remaining 16 modules (PARALLELIZABLE)

> Run in an isolated worktree (concurrency). One subagent per module. Each module is independent; gate each on: `tsc --noEmit` clean + `compose([deps..., module])` ok + module `check:spec` + its `connections.test.ts` green.

**Modules (16):** admin-shell, audit-log, billing-subscriptions, booking, calendar-google, customer, email, file-media, forms-intake, gateway, invoice, jobs-workflows, notifications-inapp, org-team-rbac, support-ticket, webhook-delivery.

### Task 10: per-module migration recipe (repeat for each)

Mirror the auth/payment reference migrations (see Phase 2 commits `e002823`, `dc79c29`):

- [ ] **Step 1:** `module.json` — replace flat `requires`/`optional`/`hooks`/`events`/`rpc` with a nested `connections` block. Map: `hooks[]` → `hookPoints{}` (choose `kind` per hook: input-mutating ⇒ `filter`, veto ⇒ `guard`, side-effect ⇒ `observer`) + `provides.hooks` if it registers into another module; `events[]` → `events.emits`; declare `events.consumes` + `rpc.calls` explicitly (was implicit); add any new hookPoint scopes to `permissions`.
- [ ] **Step 2:** `package.json` — add `"@microservices-sh/connection-contract": "workspace:*"`.
- [ ] **Step 3:** use-cases — return the unified `ok()/err()` envelope with `meta` (add a `src/meta.ts` helper like auth/payment); namespaced error codes (`<id>.CODE`); thread `correlationId` via `deps.correlationId`; cross-module hook points call `runHooks(...)` with `deps.<hook>Hooks`.
- [ ] **Step 4:** add `modules/<id>/tests/connections.test.ts` — `compose([deps, <id>])` ok + envelope/meta assertions + any hook test.
- [ ] **Step 5:** `pnpm --filter @microservices-sh/<id> build` (tsc) clean + `pnpm exec vitest run modules/<id>` green + `check:spec` pass.
- [ ] **Step 6: Commit** `refactor(<id>): migrate to connection standard`.

**⚠️ `email` dual tree:** apply identically to BOTH `modules/email` and `modules/modules/email`; keep byte-identical (see [[email-module-dual-trees]]). Verify with `diff -r`.

**Special cases to flag for the migrating agent:**
- `gateway` calls `auth.mintToken` (embedded vs binding minter) — declare `rpc.calls:[auth.mintToken]` + scope `auth.mint`; grant the scope.
- `audit-log` is the universal event sink — `events.consumes` is broad; it may legitimately consume events from many emitters (rule 2 should pass since emitters are present, or mark sources optional).
- `webhook-delivery` is also a sink.

---

## Sub-phase 3D — Remove shims + finish

### Task 11: remove workspace-tools flat fallbacks

**Files:** `packages/workspace-tools/src/index.js` (the `normalizeManifestConnections` + scaffolder), `packages/workspace-tools/tests/connections.test.js`

- [ ] **Step 1:** Update the test to assert flat-field inputs are NO LONGER accepted (or simply that all real modules carry `connections`). **Step 2:** Remove the `?? manifest.hooks` etc. fallbacks (the `// TODO(phase3)` lines) from `normalizeManifestConnections`; update the scaffolder (`scaffold module`) to emit a `connections` block, not flat fields. **Step 3:** `pnpm spec:check:all` green for all 18 modules. **Step 4: Commit** `refactor(workspace-tools): drop flat-field fallbacks`

### Task 12: reshape module-contract internal MODULES

**Files:** `packages/module-contract/src/index.js`, `.d.ts`, `packages/module-contract/tests/contract.test.js`

- [ ] **Step 1: Write failing test** — `inspectModule("payment").connections.events.emits` is the source of truth; `composeApp`/`createModuleLock` derive their aggregates from `connections`.
- [ ] **Step 2: Run** → FAIL. **Step 3:** Reshape the `MODULES` array entries to carry `connections` (drop `eventsEmitted`/`eventsConsumed`/flat `hooks`); update `composeApp` + `createModuleLock` + `listModules` to read `connections.*`; make `connections` required in the type. **Step 4:** `pnpm test` + the CLI smoke (`pnpm cli -- compose booking-business --json`) green. **Step 5: Commit** `refactor(module-contract): connections is the source of truth`

### Task 13: `microservices graph` CLI command

**Files:** `packages/cli/src/**`, `packages/cli/tests/**` (follow existing CLI command patterns)

- [ ] **Step 1: Write failing test** — `microservices graph booking-business --json` prints the resolved `wiring` (modules, rpc edges, event edges, hook chains). **Step 2: Run** → FAIL. **Step 3:** Implement by calling `compose()` over the composed module set. **Step 4: Run** → PASS. **Step 5: Commit** `feat(cli): graph command renders the honeycomb`

### Task 14: wire e2e into CI

**Files:** `.github/workflows/ci.yml`

- [ ] **Step 1:** Add a `pnpm test:e2e` step (pool-workers). **Step 2:** Commit `ci: gate on both-topology e2e`.

---

## Definition of Done (Phase 3 exit gate)

- Codegen produces RPC entrypoints/clients, event routing table, and ordered hook maps from `wiring.json`; `emitArtifacts` orchestrates them.
- Both-topology e2e (scenarios 1–7) green in **embedded AND service** modes.
- All 18 modules carry `connections`; the `email` dual tree is byte-identical; `pnpm spec:check:all` green.
- Flat-field fallbacks removed from `workspace-tools`; `module-contract` MODULES reshaped to `connections`-as-source.
- `microservices graph` renders the honeycomb; CI gates on `pnpm test` + `pnpm test:e2e`.
- The pre-existing `templates/` "missing required template files" failure (flagged in Phase 2) is resolved or explicitly tracked separately — it currently reds `spec:check:all` independently of this work.

## Out of scope (still YAGNI)
- Capability/port-based binding, runtime hot-plug/DI, GraphQL/REST auto-gen, per-module rate-limit standardization (Plan 25 §11).
