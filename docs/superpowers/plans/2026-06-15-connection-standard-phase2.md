# Module Connection Standard — Phase 2 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `@microservices-sh/connection-contract` package + build-time composer + correlation IDs, and migrate `auth` + `payment` as reference modules — the sequential foundation every other module's migration (Phase 3) depends on.

**Architecture:** Hybrid (Plan 25 decision C). A new ESM package holds the shared envelope/types, error-code registry, status map, manifest zod schema, HMAC envelope sign/verify, and the `runHooks` runtime dispatcher. A separate composer module resolves a selected module set into a validated `wiring.json` (7 rules, build-fail on violation). `auth` + `payment` migrate to the new `connections` manifest block + `meta`-bearing `Result` returns + typed `hookPoints`, proving RPC + events + hooks end to end.

**Tech Stack:** pnpm 10 workspace, ESM JS + `.d.ts` (matching `packages/module-contract`), `vitest` ^3.2.4 (`pnpm test`), `zod` for schemas, WebCrypto HMAC (porting `modules/audit-log/src/envelope.ts`), `@cloudflare/vitest-pool-workers` for the e2e topology harness.

**Spec:** `plans/25-module-connection-standard.md` (sections 3–10).

**Scope note:** Phase 3 (migrate the remaining 16 modules) is a *separate* plan — it is the parallelizable work and is gated on this plan completing. Do not start it here.

**Two decisions locked after plan review (read before starting):**
- **Flat manifest fields are REPLACED, not duplicated.** The nested `connections` block replaces the old flat `requires`/`optional`/`hooks`/`events`/`rpc` fields in `module.json`. No two-sources-of-truth. Every reader of the old fields must be updated (Task 11 covers `module-contract` AND `packages/workspace-tools/src/index.js`).
- **Phase 2 e2e is EMBEDDED-only.** Service-mode RPC client/entrypoint codegen + event routing-table generation are *Phase 3 (Connector)* deliverables. Therefore the both-topology parity scenario (spec §10 #6) and the composer→service-runtime pipeline (#7) move to the Phase 3 exit gate. Phase 2 proves the contract end-to-end *in-process*. Task 15 is descoped accordingly.

---

## File Structure

**New package — `packages/connection-contract/`:**
- `package.json` — `@microservices-sh/connection-contract`, ESM, exports map, `node --check` build, zod dep.
- `src/index.js` / `src/index.d.ts` — barrel re-exports.
- `src/envelope.js` / `.d.ts` — `ok()`, `err()` constructors; `Result`/`Err`/`Meta` types; runtime guards.
- `src/errors.js` / `.d.ts` — central error-code registry + `STATUS` map + `statusFor(category)`.
- `src/correlation.js` / `.d.ts` — `newCorrelationId()`, `CORRELATION_HEADER`, `withMeta()`.
- `src/event-envelope.js` / `.d.ts` — `signEnvelope()`, `verifyEnvelope()`, `canonical()` (ported, now incl. `correlationId`).
- `src/hooks.js` / `.d.ts` — `runHooks(point, input, ctx, chain)` (filter/guard/observer semantics).
- `src/manifest.js` / `.d.ts` — zod schema for the `connections` manifest block.
- `tests/*.test.js` — one test file per source module.

**New composer — `packages/connection-contract/src/composer/`:**
- `compose.js` / `.d.ts` — entry: `compose(modules) → { wiring, errors }`.
- `rules.js` — the 7 validation rules, each `(graph) → Issue[]`.
- `graph.js` — build the resolved graph (rpc edges, event edges, hook chains) from manifests.
- `tests/composer/*.test.js`.

**Reference migrations:**
- `modules/auth/module.json`, `modules/payment/module.json` — add `connections` block + `hookPoints`.
- `modules/auth/src/**`, `modules/payment/src/**` — `meta` on returns; payment exposes typed `hookPoints`.
- `packages/module-contract/src/index.d.ts` + `src/index.js` — reconcile `eventsEmitted`/`eventsConsumed`/`hooks` → nested `connections` shape.

**E2E harness — `tests/e2e/`:**
- `fixtures/compose-app.js` — compose `[auth, customer, payment, booking, audit-log]`.
- `helpers/flush-queues.js` — deterministic Miniflare queue drain.
- `scenarios.test.js` — the 7 scenarios, parameterized over `["embedded","service"]`.
- `vitest.e2e.config.js` — `@cloudflare/vitest-pool-workers` pool.

---

## Task 1: Scaffold the `connection-contract` package

**Files:**
- Create: `packages/connection-contract/package.json`
- Create: `packages/connection-contract/src/index.js`, `src/index.d.ts`
- Create: `packages/connection-contract/vitest.config.js`

- [ ] **Step 1: Create `package.json`** (mirror `packages/module-contract/package.json`)

```json
{
  "name": "@microservices-sh/connection-contract",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.js",
  "types": "src/index.d.ts",
  "exports": {
    ".": { "types": "./src/index.d.ts", "import": "./src/index.js", "default": "./src/index.js" },
    "./envelope": "./src/envelope.js",
    "./errors": "./src/errors.js",
    "./correlation": "./src/correlation.js",
    "./event-envelope": "./src/event-envelope.js",
    "./hooks": "./src/hooks.js",
    "./manifest": "./src/manifest.js",
    "./composer": "./src/composer/compose.js"
  },
  "scripts": { "build": "node --check src/index.js", "test": "vitest run" },
  "dependencies": { "zod": "^3.25.76" },
  "files": ["src"],
  "license": "MIT",
  "publishConfig": { "access": "public" }
}
```

- [ ] **Step 2: Create empty barrel** `src/index.js`:

```js
export * from "./envelope.js";
export * from "./errors.js";
export * from "./correlation.js";
export * from "./event-envelope.js";
export * from "./hooks.js";
export * from "./manifest.js";
```

(Create `src/index.d.ts` re-exporting the same; stub the referenced files with `export {};` so `node --check` passes until later tasks fill them.)

- [ ] **Step 3: Install** `pnpm install` (registers the new workspace package + zod).

- [ ] **Step 4: Verify** `pnpm --filter @microservices-sh/connection-contract build` → exit 0.

- [ ] **Step 5: Extend the root test globs.** Root `vitest.config.ts` `include` is currently `["modules/*/src/**/*.test.ts"]` — it will NOT pick up `packages/**/tests/*.test.js` or `modules/*/tests/*.test.js`. Add `"packages/**/tests/**/*.test.{js,ts}"` and `"modules/*/tests/**/*.test.{js,ts}"` so the DoD `pnpm test` gate actually runs everything this plan creates. Verify `pnpm test` discovers the package (even with 0 tests yet).

- [ ] **Step 6: Commit** `git add packages/connection-contract vitest.config.ts && git commit -m "feat(connection-contract): scaffold package + test globs"`

---

## Task 2: Envelope constructors (`ok` / `err`) + `Meta`

**Files:**
- Modify: `packages/connection-contract/src/envelope.js`, `src/envelope.d.ts`
- Test: `packages/connection-contract/tests/envelope.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect } from "vitest";
import { ok, err, isOk } from "../src/envelope.js";

const meta = { requestId: "r1", correlationId: "c1", source: "auth", ts: "2026-06-15T00:00:00Z" };

describe("envelope", () => {
  it("ok() wraps data with meta", () => {
    const r = ok(200, { token: "x" }, meta);
    expect(r).toEqual({ ok: true, status: 200, data: { token: "x" }, meta });
    expect(isOk(r)).toBe(true);
  });
  it("err() wraps a structured error with meta", () => {
    const r = err(403, { code: "auth.FORBIDDEN_SCOPE", message: "no" }, meta);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.error.code).toBe("auth.FORBIDDEN_SCOPE");
    expect(r.meta).toEqual(meta);
  });
  it("err() rejects an error missing code/message", () => {
    expect(() => err(500, { message: "x" }, meta)).toThrow();
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @microservices-sh/connection-contract test -- envelope` → FAIL (not implemented).

- [ ] **Step 3: Implement** `src/envelope.js`:

```js
export function ok(status, data, meta) {
  return { ok: true, status, data, meta };
}
export function err(status, error, meta) {
  if (!error || typeof error.code !== "string" || typeof error.message !== "string") {
    throw new Error("err() requires error.code and error.message strings");
  }
  return { ok: false, status, error, meta };
}
export const isOk = (r) => r.ok === true;
export const isErr = (r) => r.ok === false;
```

Add matching types to `src/envelope.d.ts` (`Result<T>`, `Err`, `Meta` per Plan 25 §4).

- [ ] **Step 4: Run** test → PASS.
- [ ] **Step 5: Commit** `feat(connection-contract): Result envelope constructors`

---

## Task 3: Error-code registry + status map

**Files:**
- Modify: `packages/connection-contract/src/errors.js`, `.d.ts`
- Test: `tests/errors.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect } from "vitest";
import { STATUS, statusFor, registerCodes, errorCode } from "../src/errors.js";

describe("errors", () => {
  it("maps categories to status codes", () => {
    expect(statusFor("validation")).toBe(400);
    expect(statusFor("auth")).toBe(401);
    expect(statusFor("scope")).toBe(403);
    expect(statusFor("notFound")).toBe(404);
    expect(statusFor("conflict")).toBe(409);
    expect(statusFor("upstream")).toBe(502);
    expect(statusFor("internal")).toBe(500);
  });
  it("registers namespaced codes and rejects unregistered", () => {
    registerCodes("payment", ["INTENT_FAILED"]);
    expect(errorCode("payment", "INTENT_FAILED")).toBe("payment.INTENT_FAILED");
    expect(() => errorCode("payment", "NOPE")).toThrow();
  });
  it("rejects duplicate registration of the same code", () => {
    expect(() => registerCodes("payment", ["INTENT_FAILED"])).toThrow();
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `src/errors.js`:

```js
export const STATUS = {
  validation: 400, auth: 401, scope: 403, notFound: 404,
  conflict: 409, upstream: 502, internal: 500,
};
export function statusFor(category) {
  const s = STATUS[category];
  if (!s) throw new Error(`Unknown error category: ${category}`);
  return s;
}
const registry = new Map(); // "module" -> Set<name>
export function registerCodes(moduleId, names) {
  const set = registry.get(moduleId) ?? new Set();
  for (const n of names) {
    if (set.has(n)) throw new Error(`Duplicate error code ${moduleId}.${n}`);
    set.add(n);
  }
  registry.set(moduleId, set);
}
export function errorCode(moduleId, name) {
  if (!registry.get(moduleId)?.has(name)) {
    throw new Error(`Unregistered error code ${moduleId}.${name}`);
  }
  return `${moduleId}.${name}`;
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(connection-contract): error-code registry + status map`

---

## Task 4: Correlation IDs

**Files:**
- Modify: `packages/connection-contract/src/correlation.js`, `.d.ts`
- Test: `tests/correlation.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect } from "vitest";
import { newCorrelationId, CORRELATION_HEADER, withMeta } from "../src/correlation.js";

describe("correlation", () => {
  it("generates unique ids", () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId());
  });
  it("exposes the propagation header name", () => {
    expect(CORRELATION_HEADER).toBe("x-msh-correlation-id");
  });
  it("withMeta carries an existing correlationId or mints one", () => {
    const m = withMeta({ source: "auth", correlationId: "c1", requestId: "r1", ts: "t" });
    expect(m.correlationId).toBe("c1");
    const m2 = withMeta({ source: "auth", requestId: "r2", ts: "t" });
    expect(typeof m2.correlationId).toBe("string");
    expect(m2.correlationId.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** using `crypto.randomUUID()` (WebCrypto, available in Workers + Node 18+):

```js
export const CORRELATION_HEADER = "x-msh-correlation-id";
export const newCorrelationId = () => crypto.randomUUID();
export function withMeta(partial) {
  return { ...partial, correlationId: partial.correlationId ?? newCorrelationId() };
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(connection-contract): correlation ids`

---

## Task 5: Event envelope sign/verify (port + correlationId in signed payload)

**Files:**
- Read first: `modules/audit-log/src/envelope.ts`, `modules/audit-log/src/types.ts`
- Modify: `packages/connection-contract/src/event-envelope.js`, `.d.ts`
- Test: `tests/event-envelope.test.js`

- [ ] **Step 1: Write failing test** (correlationId MUST be part of the signature)

```js
import { describe, it, expect } from "vitest";
import { signEnvelope, verifyEnvelope } from "../src/event-envelope.js";

const base = {
  eventName: "payment.succeeded", entityType: "payment", entityId: "p1",
  source: "payment", actorId: null, correlationId: "c1", payload: { amount: 100 },
};

describe("event-envelope", () => {
  it("signs and verifies", async () => {
    const signed = await signEnvelope(base, "secret");
    expect(signed.signature).toBeTypeOf("string");
    expect(await verifyEnvelope(signed, "secret")).toBe(true);
  });
  it("fails verification if correlationId is tampered (it is signed)", async () => {
    const signed = await signEnvelope(base, "secret");
    const tampered = { ...signed, correlationId: "c2" };
    expect(await verifyEnvelope(tampered, "secret")).toBe(false);
  });
  it("fails on wrong secret", async () => {
    const signed = await signEnvelope(base, "secret");
    expect(await verifyEnvelope(signed, "other")).toBe(false);
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — port `hmac`/`canonical`/`signEnvelope`/`verifyEnvelope` from `modules/audit-log/src/envelope.ts`, but extend `canonical()` to include `correlationId` (stable key order). Keep the constant-time compare.
- [ ] **Step 4:** Also add the `correlationId` field to the source `EventEnvelope` type in `modules/audit-log/src/types.ts` (spec §8) so audit-log's own emit/consume paths carry it. The audit-log module will switch to importing sign/verify from `@microservices-sh/connection-contract` during its Phase 3 migration; for now just add the field + keep its local envelope consistent with the ported `canonical()`.
- [ ] **Step 5: Run** → PASS. **Step 6: Commit** `feat(connection-contract): signed event envelope with correlationId`

---

## Task 6: `runHooks` dispatcher (filter / guard / observer)

**Files:**
- Modify: `packages/connection-contract/src/hooks.js`, `.d.ts`
- Test: `tests/hooks.test.js`

- [ ] **Step 1: Write failing tests** covering all kinds + error semantics (Plan 25 §5)

```js
import { describe, it, expect, vi } from "vitest";
import { runHooks } from "../src/hooks.js";

const ctx = { correlationId: "c1" };

describe("runHooks", () => {
  it("filters fold input in order", async () => {
    const chain = [
      { kind: "filter", order: 10, fn: async (i) => ({ ...i, a: 1 }) },
      { kind: "filter", order: 20, fn: async (i) => ({ ...i, b: i.a + 1 }) },
    ];
    const r = await runHooks("p", { a: 0 }, ctx, chain);
    expect(r).toEqual({ ok: true, value: { a: 1, b: 2 } });
  });
  it("guard veto aborts and surfaces its error", async () => {
    const chain = [{ kind: "guard", order: 10, fn: async () => ({ ok: false, status: 409, error: { code: "x.NO", message: "no" } }) }];
    const r = await runHooks("p", {}, ctx, chain);
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("x.NO");
  });
  it("filter throw aborts with HOOK_FAILED", async () => {
    const chain = [{ kind: "filter", order: 10, fn: async () => { throw new Error("boom"); } }];
    const r = await runHooks("p", {}, ctx, chain);
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("HOOK_FAILED");
  });
  it("observer throw is swallowed; op continues", async () => {
    const spy = vi.fn(async () => { throw new Error("ignored"); });
    const chain = [{ kind: "observer", order: 10, fn: spy }];
    const r = await runHooks("p", { v: 1 }, ctx, chain);
    expect(spy).toHaveBeenCalled();
    expect(r).toEqual({ ok: true, value: { v: 1 } });
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `runHooks` — sort by `order`, fold filters, short-circuit on guard `ok:false`, wrap filter throws as `HOOK_FAILED`, run observers in try/catch that logs and continues. Returns `{ ok:true, value } | { ok:false, status, error }`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(connection-contract): runHooks dispatcher`

---

## Task 7: `connections` manifest zod schema

**Files:**
- Modify: `packages/connection-contract/src/manifest.js`, `.d.ts`
- Test: `tests/manifest.test.js`

- [ ] **Step 1: Write failing test** — valid block parses; bad `kind`, missing `target`, negative `order` reject.

```js
import { describe, it, expect } from "vitest";
import { connectionsSchema } from "../src/manifest.js";

const valid = {
  requires: ["auth"], optional: [],
  rpc: { exposes: [{ method: "m", scope: "x.write", public: false, input: "schemas/i.json", output: "schemas/o.json" }], calls: [{ target: "auth.verifyToken", scope: "auth.verify" }] },
  events: { emits: ["x.done"], consumes: ["y.made"] },
  hookPoints: { beforeM: { kind: "filter", input: "schemas/i.json", output: "schemas/i.json", scope: "x.extend" } },
  provides: { hooks: [{ target: "auth.beforeMint", handler: "src/hooks/h.ts", order: 100 }] },
};

describe("connectionsSchema", () => {
  it("parses a valid block", () => expect(connectionsSchema.safeParse(valid).success).toBe(true));
  it("rejects unknown hook kind", () => {
    const bad = structuredClone(valid); bad.hookPoints.beforeM.kind = "nope";
    expect(connectionsSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects provides.hooks missing target", () => {
    const bad = structuredClone(valid); delete bad.provides.hooks[0].target;
    expect(connectionsSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the zod schema (kinds enum `filter|guard|observer`, `order` int ≥ 0, all arrays default `[]`). **Step 4: Run** → PASS. **Step 5: Commit** `feat(connection-contract): connections manifest schema`

---

## Task 8: Composer graph builder

**Files:**
- Create: `packages/connection-contract/src/composer/graph.js`, `.d.ts`
- Test: `tests/composer/graph.test.js`

- [ ] **Step 1: Write failing test** — given two parsed manifests, `buildGraph(modules)` returns `{ rpcEdges, eventEdges, hookChains, scopesByModule }` with expected edges (event `emits`→`consumes` matched; hook `provides`→`hookPoints` matched; rpc `calls`→`exposes` matched).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `buildGraph` — pure function, no validation yet, just resolve edges + index scopes/hookPoints by module id.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(composer): graph builder`

---

## Task 9: Composer validation rules (one sub-task per rule)

**Files:**
- Create: `packages/connection-contract/src/composer/rules.js`
- Test: `tests/composer/rules.test.js`

Implement the 7 rules from Plan 25 §7. **Each rule is its own TDD micro-cycle** (failing test with a fixture that violates the rule → implement rule → green → commit). Put shared fixtures in `tests/composer/fixtures/` — one minimal violating manifest-set per rule (e.g. `missing-module.js`, `dangling-consumer.js`, `scope-gap.js`, `hook-target-missing.js`, `order-collision.js`, `schema-mismatch.js`, `dependency-cycle.js`) plus one `valid-set.js` reused across green-path assertions. Order:

- [ ] **9.1** Missing required module (`requires`/`rpc.calls` target absent) → `MISSING_MODULE`
- [ ] **9.2** Dangling consumer (`consumes` with no emitter) → `DANGLING_CONSUMER` (warn if optional, error otherwise)
- [ ] **9.3** Scope gap (caller/registrant lacks required scope) → `SCOPE_GAP`
- [ ] **9.4** Hook target missing (`provides.hooks` → nonexistent hookPoint) → `HOOK_TARGET_MISSING`
- [ ] **9.5** Order collision (same hookPoint + same order) → `HOOK_ORDER_COLLISION`
- [ ] **9.6** Schema mismatch (declared call input ≠ exposed input) → `SCHEMA_MISMATCH`
- [ ] **9.7** Dependency cycle in `requires`/rpc (events/hooks may cycle) → `DEPENDENCY_CYCLE`

Each rule signature: `(graph, modules) => Issue[]` where `Issue = { rule, severity: "error"|"warn", code, message, module, detail }`. Commit after each rule passes.

---

## Task 10: Composer entry + `wiring.json`

**Files:**
- Create: `packages/connection-contract/src/composer/compose.js`, `.d.ts`
- Test: `tests/composer/compose.test.js`

- [ ] **Step 1: Write failing tests:** (a) a valid 3-module set → `{ ok: true, wiring }` with resolved `rpcEdges/eventEdges/hookChains`; (b) a set violating a rule → `{ ok: false, issues }` and no wiring; (c) `wiring` is JSON-serializable and stable (sorted keys).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `compose(modules)`: parse each manifest via `connectionsSchema`, `buildGraph`, run all rules, if any `error`-severity issue → return `{ ok:false, issues }`, else assemble + return `{ ok:true, wiring }`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(composer): compose entry + wiring.json`

---

## Task 11: Reconcile ALL flat-field readers to the new `connections` shape

This is the single most error-prone task — there are **two** sources of truth plus a generator, all reading the old flat fields. All must move to `connections` together (replacement, not duplication).

**Files:**
- Read first: `packages/module-contract/src/index.d.ts`, `src/index.js`; `packages/workspace-tools/src/index.js` (the registry/catalog generator + spec validator — reads `manifest.hooks`, `manifest.events || manifest.eventsEmitted`, etc., ~line 1035).
- Modify: all three.
- Test: `packages/module-contract/tests/contract.test.js`, `packages/workspace-tools/tests/connections.test.js` (create if absent).

- [ ] **Step 1: Write failing test (module-contract)** asserting the exported contract uses the nested `connections` shape (`connections.events.emits`, `connections.rpc.exposes`, `connections.provides.hooks`) rather than flat `eventsEmitted`/`eventsConsumed`/`hooks`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Migrate `module-contract`** — `ModuleContract` type + the `MODULES` JS objects to the nested shape. Keep `id/name/version/status/summary/quality`. **Pre-existing drift to fix while here:** `.d.ts` has no `rpc` field though `.js` carries `rpc: [...]`; `category` type is `"core"|"vertical"|"connector"` but data uses `"vertical"|"sink"|"provider"` and `module.json` uses `class:"platform"`. Reconcile `category`/`class` to one enum.
- [ ] **Step 4: Write failing test (workspace-tools)** asserting registry/catalog build reads `connections.*` (hooks/events/rpc survive a build from a `connections`-only manifest).
- [ ] **Step 5: Migrate `workspace-tools`** — make every flat-field read prefer `manifest.connections.*` with a **temporary fallback** to the old flat field, e.g. `const emits = manifest.connections?.events?.emits ?? manifest.events ?? manifest.eventsEmitted ?? []`. **There are two reader sites, not one** — the registry/catalog entry (~lines 1033-1036) AND the codegen/scaffold path (~lines 691, 698, 721, 762-764, which read `manifest.hooks`/`manifest.events`). Update both, or `connections`-only manifests will break `microservices generate`. Mark each with `// TODO(phase3): drop flat fallback`; removed in the Phase 3 plan once all modules carry `connections`.
- [ ] **Step 6: Run** both tests → PASS, then `pnpm spec:check:all` → green for ALL modules (migrated auth/payment via `connections`, the other 16 via fallback).
- [ ] **Step 7: Commit** `refactor: nested connections shape across module-contract + workspace-tools`

---

## Task 12: Migrate `auth` reference module

**Files:**
- Read first: `modules/auth/module.json`, `modules/auth/src/use-cases/*.ts`, `src/rpc.ts`, `src/hooks.ts`, `src/scope.ts`, `src/events/index.ts`
- Modify: `modules/auth/module.json` (+ `src/**`)
- Test: existing auth tests + `modules/auth/tests/connections.test.js`

- [ ] **Step 1:** Add the `connections` block to `modules/auth/module.json` (rpc.exposes: mintToken/verifyToken/getJwks with scopes; events.emits: auth.token_minted/key_rotated; hookPoints: beforeMintToken=filter, afterTokenMinted=observer).
- [ ] **Step 2: Write failing test** asserting `compose([auth])` is `ok` and every auth use-case return includes `meta.correlationId` + a registered `code`.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4:** Migrate auth use-cases to import `ok/err/withMeta/errorCode` from `@microservices-sh/connection-contract`; register auth codes (`registerCodes("auth", [...])`); thread `correlationId` from input ctx into `meta`; convert `beforeMintToken`/`afterTokenMinted` into declared typed `hookPoints`.
- [ ] **Step 5: Run** all auth tests + the new one → PASS.
- [ ] **Step 6: Commit** `refactor(auth): migrate to connection standard`

---

## Task 13: Migrate `payment` reference module (proves hooks as extension points)

**Files:**
- Read first: `modules/payment/module.json`, `modules/payment/src/use-cases/*.ts`, `src/hooks.ts`, `src/webhook.ts`
- Modify: `modules/payment/module.json` (+ `src/**`)
- Test: existing payment tests + `modules/payment/tests/connections.test.js`

> **No invented cross-calls.** Today `payment` only depends on `paymentRepository` + `paymentGateway` — it does NOT call `customer.getCustomer`. Do not add that call here (it would be a new feature, not a migration). The only RPC `payment` legitimately needs is `auth.verifyToken` for caller-token verification, which the service-mode dispatcher already does at the entrypoint. So `rpc.calls` for payment = `auth.verifyToken` only. The `booking→customer.getCustomer` RPC-happy demo lives in the e2e fixture (Task 15): the target `customer.getCustomer` use-case already exists and is exported from `@microservices-sh/customer`, but booking does not call it today — the e2e fixture wires that edge for the scenario (it does not exist in product code).

- [ ] **Step 1:** Add `connections` block: rpc.exposes `createPaymentIntent`; rpc.calls `auth.verifyToken`; events.emits the 4 payment events; **hookPoints**: `beforeCreatePaymentIntent` (filter, scope `payment.extend`), `afterPaymentSucceeded` (observer, scope `payment.observe`).
- [ ] **Step 2: Write failing test** asserting `compose([auth, payment])` is `ok`, and a simulated `provides.hooks` registrant against `payment.beforeCreatePaymentIntent` resolves into a `hookChain` and `runHooks` applies it.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4:** Migrate `createPaymentIntent` to call `runHooks("beforeCreatePaymentIntent", input, ctx, chain)` before gateway call; emit signed events with `correlationId`; `ok/err` + registered codes + `meta`. Do not change payment's runtime deps.
- [ ] **Step 5: Run** → PASS. **Step 6: Commit** `refactor(payment): migrate to connection standard + typed hookPoints`

---

## Task 14: Integration test (in-process compose)

**Files:**
- Create: `tests/integration/compose-auth-payment.test.js`

- [ ] **Step 1: Write test:** compose `[auth, payment]`, boot in-process (embedded), and assert: (a) payment verifies a caller token via `auth.verifyToken` (real existing call) → `403` on missing scope, `ok` with valid token; (b) `payment.succeeded` event is signed + verified; (c) a registered filter hook mutates `createPaymentIntent` input and a guard can veto; (d) one `correlationId` appears across the auth-verify call + emitted event + hook ctx.
- [ ] **Step 2: Run** → exercise; fix wiring until green.
- [ ] **Step 3: Commit** `test: integration compose auth+payment`

---

## Task 15: E2E harness — DEFERRED to Phase 3

> **Execution note (2026-06-15):** Deferred. The `@cloudflare/vitest-pool-workers`
> harness must *boot a composed app* (a worker entry that mounts modules + a queue
> consumer), but that worker-boot/runtime artifact is itself a Phase 3 connector
> deliverable — there is no app to boot in Phase 2. Task 14's in-process integration
> test already covers scenarios 1–5 behaviorally at the contract level (RPC gate +
> 403/401, filter/guard hooks, signed event, correlationId thread). Building a
> throwaway worker harness now would be scaffolding discarded in Phase 3. The
> pool-workers e2e (all scenarios, both topologies) lands in Phase 3 with the runtime.

### Original spec (carried to Phase 3): E2E harness — EMBEDDED topology only

> **Why embedded-only:** spec §10's both-topology suite requires service-mode RPC client/entrypoint codegen + the generated event routing table, which are **Phase 3 (Connector)** deliverables. Phase 2 proves the contract in-process. Scenarios 6 (topology parity) and 7 (composer→service-runtime pipeline) are deferred to the Phase 3 exit gate. The e2e files are written now so the suite is *parameterizable over topology* later — Phase 3 just adds the `"service"` arm.

**Files:**
- Create: `tests/e2e/vitest.e2e.config.js` (`@cloudflare/vitest-pool-workers`)
- Create: `tests/e2e/fixtures/compose-app.js` (compose `[auth, customer, payment, booking, audit-log]`, boot embedded)
- Create: `tests/e2e/helpers/flush-queues.js`
- Create: `tests/e2e/scenarios.test.js`
- Modify: root `package.json` → add `"test:e2e": "vitest run -c tests/e2e/vitest.e2e.config.js"`

- [ ] **Step 1:** Add dev dep `@cloudflare/vitest-pool-workers`; write the config with D1 + Queues bindings (embedded = single worker; no service bindings needed yet).
- [ ] **Step 2:** Implement `flushQueues()` helper (deterministic Miniflare drain — no sleeps).
- [ ] **Step 3:** Build `compose-app.js` fixture: run the real `compose()` on the 5 modules, boot the in-process app from the resulting wiring.
- [ ] **Step 4: Write scenarios 1–5** (spec §10), parameterized `describe.each(["embedded"])` (the array is the seam Phase 3 extends to `["embedded","service"]`):
  1. RPC happy — `booking → customer.getCustomer` returns data + envelope.
  2. RPC auth-gate (negative) — missing scope → `403 FORBIDDEN_SCOPE`; expired JWT → `401`.
  3. Event fan-out — `payment.succeeded` → booking consumer + audit-log sink; HMAC verified; tampered envelope rejected.
  4. Hook chain — `payment.beforeCreatePaymentIntent` filter mutates (ordered) + a guard vetoes → intent aborts with guard error.
  5. Correlation ID — one inbound request → same `correlationId` in RPC hop + event envelope + hook ctx + audit-log row (survives the async queue hop via `flushQueues()`).
- [ ] **Step 5: Run** `pnpm test:e2e` → iterate until scenarios 1–5 pass embedded.
- [ ] **Step 6: Commit** `test(e2e): connection standard scenarios (embedded)`

---

## Task 16: CI gate + `microservices graph`

**Files:**
- Modify: root `package.json` (test scripts), CI workflow if present
- Optionally: `packages/cli/src/**` add `graph` subcommand printing `wiring.json`

- [ ] **Step 1:** Wire `pnpm test` (unit+integration) and `pnpm test:e2e` into the CI gate; document that composer validation must pass before module merges.
- [ ] **Step 2:** (Optional, if CLI patterns allow) add `microservices graph` rendering the resolved honeycomb from `compose()`.
- [ ] **Step 3: Commit** `chore(ci): gate on composer + e2e; add graph command`

---

## Definition of Done (Phase 2 exit gate)

- `@microservices-sh/connection-contract` published-shape package: envelope, errors, correlation, event-envelope, hooks, manifest schema, composer — all unit-green.
- Composer enforces all 7 rules; emits stable `wiring.json`.
- `auth` + `payment` migrated to `connections`; `module-contract` + `workspace-tools` reconciled (with the temporary flat-field fallback keeping the other 16 modules green); `pnpm spec:check:all` green.
- Root `vitest.config.ts` globs cover the new package + module tests; `pnpm test` runs unit + integration green.
- Integration test (`tests/integration/compose-auth-payment.test.ts`) green — covers
  scenarios 1–5 behaviorally in-process. (Pool-workers e2e deferred to Phase 3 — see Task 15.)
- `pnpm test` wired into CI (`.github/workflows/ci.yml`) as a merge gate.
- This is the precondition for the **Phase 3 plan**, which: (a) adds service-mode codegen + the generated event routing table, (b) extends the e2e suite to `["embedded","service"]` and adds scenarios 6 (topology parity) + 7 (composer→service-runtime pipeline), (c) migrates the remaining 16 modules (incl. the `email` dual tree), and (d) removes the flat-field fallback from `workspace-tools`.

## Carried to Phase 3 (do not attempt here)
- Service-mode RPC client/entrypoint codegen + generated event routing table (extend `packages/sdk-internal/src/rpc-codegen.js`).
- E2E scenarios 6 (embedded vs service parity) + 7 (composer→service-runtime).
- Migrate the 16 remaining modules; remove `// TODO(phase3)` flat-field fallbacks.
- `microservices graph` CLI command (moved out of Phase 2 Task 16 unless trivial).
