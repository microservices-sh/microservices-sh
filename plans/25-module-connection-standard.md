# Plan 25 — Module Connection Standard (Honeycomb Composability)

**Status:** Design approved, pre-implementation
**Date:** 2026-06-15
**Depends on:** Plan 24 (service topology & auth comms)
**Owner:** core

## 1. Problem

Modules already declare a connection surface (`requires`, `events`, `hooks`, `rpc`,
`resources`, `permissions`) and there is a use-case response envelope
(`{ ok, status, data | error }`), 3-layer auth (service bindings → EdDSA JWT scope →
HMAC-signed queue events), and per-module before/after hooks. But the standard is
**implicit and inconsistent**, so "honeycomb" composition (user selects modules → they
wire together) is not reliable:

- Error detail shape varies (Zod `issues` vs `code`+`message` vs `remediation`).
- No correlation/request ID threaded across service hops.
- Contracts are *declared* but not *runtime-enforced* — each module self-polices.
- Hooks are local customization seams, **not** a cross-module wiring mechanism.
- API/HTTP layer envelope ≠ module RPC envelope.

This plan consolidates the existing standard, closes the gaps, and adds the connector
layer that materializes the honeycomb wiring.

## 2. Decisions (locked)

- **Scope:** all three phases — written spec → runtime enforcement → connector layer.
- **Binding model:** concrete module IDs (keep `requires: ["auth","customer"]`). Not
  capability/port-based.
- **Hooks:** cross-module extension points (module B injects handlers into module A's
  flow), in addition to the existing local config-override seams.
- **Migration:** clean-slate. Design the ideal contract without legacy constraints, then
  migrate all 18 modules to conform (they are 0.1.0/experimental).
- **Resolution architecture:** Hybrid (C). Declarative contract + **build-time composer**
  (graph resolution, validation, codegen) + **thin runtime dispatch** only for the parts
  that must run at runtime (queue event delivery + ordered hook-chain invocation). RPC is
  pure codegen. No runtime auto-discovery — preserves Plan 24's "explicit, inspectable,
  no magic" principle.

## 3. The connection model — three primitives

Every cross-module connection is exactly one of:

| Primitive | Sync? | Direction | Use when | Auth gate |
|---|---|---|---|---|
| **RPC** | sync | A→B, expects result | A needs B's data/action now | EdDSA JWT scope (Plan 24) |
| **Event** | async | A emits, N consumers react later | A done, others care, A doesn't wait | HMAC-signed envelope (Plan 24) |
| **Hook** | sync | B injects into A's in-flight op | B must mutate/veto A's operation | runs in A's trust ctx, scope checked at register |

## 4. Unified envelope (all primitives + HTTP/API layer)

```ts
type Result<T> =
  | { ok: true;  status: number; data: T;    meta: Meta }
  | { ok: false; status: number; error: Err; meta: Meta }

type Err = {
  code: string;            // namespaced, from central registry: "payment.INTENT_FAILED"
  message: string;
  remediation?: string;
  issues?: ZodIssue[];     // only for validation errors
  cause?: string;          // upstream error summary, never raw secrets
}

type Meta = {
  requestId: string;       // unique per hop
  correlationId: string;   // STABLE across all hops of one logical request
  source: string;          // emitting module id
  ts: string;              // ISO-8601
}
```

- **One error schema everywhere** — kills the `issues` vs `code+message` vs `remediation`
  drift. API/HTTP layer adopts the same envelope.
- **`correlationId`** generated at the edge, propagated via header
  `x-msh-correlation-id`, and baked into event envelopes and hook contexts → end-to-end
  trace across the async queue hop.
- **`code`** drawn from a **central, per-module-namespaced error-code registry**, not
  ad-hoc strings.

> **Breaking change (clean-slate):** today's use-case return type is
> `{ ok, status, data | error }` with **no `meta`**. Adding `meta` (with required
> `correlationId`) is a breaking change to every use-case signature. `meta` is
> **required, not optional** — migrating subagents must add it to all returns, and the
> HTTP/API layer (currently `{ ok, error: "<string>" }` in
> `packages/sdk-internal/src/index.js`) must adopt the structured `Err` + `meta` shape.

**Status code map (no per-module invention):**

| Condition | status |
|---|---|
| validation failure | 400 |
| missing/invalid auth | 401 |
| scope/permission denied | 403 |
| not found | 404 |
| conflict | 409 |
| upstream/provider failure | 502 |
| internal | 500 |

## 5. Cross-module hook contract (new)

**A declares hook points** (typed, in manifest + code):

```ts
export const hookPoints = {
  beforeCreatePaymentIntent: {
    kind: "filter",            // filter | guard | observer
    input:  CreateIntentInput, // zod schema
    output: CreateIntentInput, // filter returns (maybe-mutated) input
    scope: "payment.extend",   // scope B must hold to register
  },
  afterPaymentSucceeded: { kind: "observer", input: Payment, scope: "payment.observe" },
} as const
```

**Three hook kinds — disjoint semantics:**

- **filter** — receives input, returns possibly-mutated input. Chained: output of one
  feeds the next. On critical path.
- **guard** — returns `Result<void>`. Any `ok:false` **vetoes** A's operation (A returns
  that error). Cannot mutate.
- **observer** — fire-and-forget side effect. Return ignored. Cannot mutate or veto.

**B registers via its manifest** (concrete IDs):

```jsonc
// booking module.json
"provides": {
  "hooks": [
    { "target": "payment.beforeCreatePaymentIntent",
      "handler": "src/hooks/tag-booking-meta.ts", "order": 100 }
  ]
}
```

**Ordering:** explicit integer `order` (low→high). Collision → composer build error.

**Error semantics by kind:**

- filter throws → **abort** A's op, return `{ code: "HOOK_FAILED", cause }` (filters are
  on the critical path).
- guard returns `ok:false` → abort, surface the guard's error (intended veto).
- observer throws → swallow + log, op continues.

**Resolution:** composer reads all selected modules' `provides.hooks`, validates target
exists + scope held + no order collision + input-schema match, then generates an ordered
hook map per hook point. Runtime dispatcher walks the generated chain. No discovery.

## 6. Connection manifest (`module.json` → `connections` block)

```jsonc
"connections": {
  "requires": ["auth", "customer"],     // hard dep module IDs
  "optional": ["audit-log"],            // soft: wire if present
  "rpc": {
    "exposes": [ { "method": "createPaymentIntent", "scope": "payment.write",
                   "public": false, "input": "schemas/...", "output": "schemas/..." } ],
    "calls":   [ { "target": "customer.getCustomer", "scope": "customer.read" } ]
  },
  "events": {
    "emits":    ["payment.succeeded", "payment.failed"],
    "consumes": ["booking.created"]
  },
  "hookPoints": { /* exposes — section 5 */ },
  "provides":   { "hooks": [ /* registers into others — section 5 */ ] }
}
```

Key change: **`rpc.calls` and `events.consumes` are declared, not implicit.** A module may
only call/consume what it declares → composer enforces, no hidden coupling.

## 7. Composer (build-time) — validation rules

Fails the build on any of:

1. **Missing required module** — `requires`/`rpc.calls` target a module not selected.
2. **Dangling consumer** — `consumes` an event no selected module `emits` (warn if
   `optional`, error otherwise).
3. **Scope gap** — A calls B's method / registers in B's hook but A's granted scopes lack
   the required scope.
4. **Hook target missing** — `provides.hooks` targets a non-existent hook point.
5. **Order collision** — two handlers, same hook point + same `order`.
6. **Schema mismatch** — declared call input ≠ target's exposed input schema.
7. **Dependency cycle** — `requires` graph has a cycle (events/hooks may cycle;
   rpc/`requires` may not).

**Output:** generated `wiring.json` (resolved graph, inspectable) + generated code (rpc
clients/entrypoints, event routing table, ordered hook maps). `microservices graph`
renders the honeycomb.

## 8. Runtime dispatch (thin)

- **RPC** — fully generated, no runtime layer. Generated client → service binding (service
  mode) or direct call (embedded). Same source both modes (exists, Plan 24).
- **Events** — generated routing table `eventName → [consumer handlers]`. Producer signs
  envelope (HMAC), pushes to queue; consumer verifies + dispatches. `correlationId` is
  added as a **new field on `EventEnvelope`** (`modules/audit-log/src/types.ts`) and
  **must be included in the `canonical()` signing input** (`modules/audit-log/src/envelope.ts`)
  so it is tamper-protected — adding it outside the signed payload would leave it
  unverifiable.
- **Hooks** — generated ordered map `hookPoint → [handler refs]`. Runtime
  `runHooks(point, input, ctx)` walks the chain: filters fold input, guards veto,
  observers fire safe (~30 lines, shared package). Embedded = direct calls; service mode =
  cross-worker via binding.

## 9. Phasing

### Phase 1 — Spec (this document)
Envelope, three primitives, hook kinds, manifest schema, validation rules, status/error
registries. No code.

### Phase 2 — Enforce (foundation, sequential)
- Build `@microservices-sh/connection-contract` package:
  - `Result`/`Err`/`Meta` types, error-code registry, status map.
  - `runHooks` dispatcher; envelope sign/verify (port existing HMAC); manifest zod schema.
- Build the **composer** with all 7 validation rules.
- Add correlation-ID generation + propagation (edge → header → envelope → hook ctx).
- Migrate **auth + payment** as reference modules (prove RPC + events + hooks).
- Composer validation fails the build on violations.

**Ordering traps for the implementer (do not skip):**
- The new nested `connections` block **restructures** today's flat manifest fields
  (`requires`, `optional`, `hooks: string[]`, `events: string[]`, `rpc: [...]`) **and** the
  `ModuleContract` type in `packages/module-contract/src/index.d.ts` (today:
  `eventsEmitted`/`eventsConsumed`/`hooks: ModuleHook[]`). Both must be reconciled to the
  new shape, plus anything generated from them (catalog, registry, templates — see Plan 24
  status log). This is more than `modules/*/module.json`.
- A target module must declare typed `hookPoints` **before** any module can register a
  `provides.hooks` against it (composer rules 4 & 6 require it). So auth + payment must add
  `hookPoints` declarations in Phase 2 **before** any Phase 3 module registers against them.

### Phase 3 — Connector (parallelizable)
- Codegen wiring (rpc clients/entrypoints, event routing table, ordered hook maps) from
  the selected module set + `wiring.json` + `microservices graph`.
- Migrate remaining 16 modules — **parallelizable**, one subagent per module, each gated by
  composer validation passing. ⚠️ `email` exists as two byte-identical trees
  (`modules/modules/email` + `microservices-sh/modules/email`) — migrate both.

## 10. Testing

**Harness:** `@cloudflare/vitest-pool-workers` (Miniflare) — real Workers + D1 + Queues +
service bindings locally. Optional real-preview smoke via dispatcher (post-merge stage).

**Pyramid:**

- **Contract (unit):** per primitive — envelope conformance, error schema, status-map
  correctness, hook chain (filter folds, guard vetoes, observer-throw swallowed + op
  continues), HMAC sign/verify.
- **Composer (unit):** all 7 validation rules each fail the build as designed + happy path
  emits correct `wiring.json`.
- **Integration:** one generated wiring, in-process — A→B RPC, A emits→B consumes, B's
  hook mutates A's input.

**E2E — run the SAME suite twice, once per topology (embedded + service):**

```
fixture app = compose [auth, customer, payment, booking, audit-log]
  → composer → generated wiring → boot (embedded) AND (service)
  → run identical scenario suite against each
```

Scenarios (asserted in **both** modes):

1. **RPC happy** — booking calls `customer.getCustomer` across boundary → `data`, correct
   envelope.
2. **RPC auth-gate (negative)** — missing scope → `403 FORBIDDEN_SCOPE`, no data leak;
   expired JWT → `401`; service mode binding rejects unauthed.
3. **Event fan-out** — `payment.succeeded` → booking consumer reacts AND audit-log records;
   HMAC verified; tampered envelope rejected.
4. **Hook chain** — `payment.beforeCreatePaymentIntent`: booking filter mutates input
   (ordered); a guard vetoes a bad case → intent aborts with guard's error.
5. **Correlation ID** — one inbound request → same `correlationId` in the RPC hop, emitted
   event envelope, hook ctx, AND the audit-log row (trace survives async queue hop).
6. **Topology parity** — diff embedded vs service results for 1–5: identical modulo
   latency/`requestId`. This is the honeycomb guarantee.
7. **Composer→runtime pipeline** — start from raw module set, run real composer, boot
   generated app, hit it (catches codegen drift).

**Flakiness guard:** async event assertions use a deterministic `flushQueues()` test
helper (Miniflare queue flush), never sleeps.

**CI gate:** composer validation + contract + e2e-both-topologies must pass before any
module merges. Reference migration (auth+payment) ships only when scenarios 1–6 are green
in both modes.

## 11. Out of scope (YAGNI)

- Capability/port-based binding (explicitly rejected — concrete IDs).
- Runtime hot-plug / DI container (rejected — build-time codegen).
- Per-module rate-limit standardization (separate concern; gateway already handles).
- GraphQL/REST auto-generation from contracts.
