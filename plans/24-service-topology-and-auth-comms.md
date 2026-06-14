# Service Topology and Auth-Gated Inter-Service Communication

## Purpose
Define how generated apps expose pre-built, modifiable services that each own their
data (service-scoped D1) and communicate through auth-gated channels — for apps on our
managed account, on the user's own account, and for existing apps not on Cloudflare.

This is the decision record for two open questions in
[`04-cloudflare-architecture.md`](./04-cloudflare-architecture.md):

- Whether each project gets one Worker or multiple service Workers.
- Whether extension hooks deploy as separate Workers or compile into the app Worker.

Scope: topology decision, the 3-layer auth-gated communication model, the booking
reference use case, external (non-Cloudflare) integration, generated folder structure,
and CLI install behavior.

## Core Principle: module = bounded context = service-scoped DB
Every module already declares its own tables and permissions in `module.json`
(`resources[].tables`, `permissions[]`). Make that boundary physical:

- Each service owns its own D1. No cross-service table reads. `booking` must never
  `SELECT` from customer tables.
- Services communicate only via (a) synchronous RPC or (b) asynchronous events.
- Without this rule, a shared D1 silently re-couples services and service-scoped data
  ownership is fiction.

This reuses the existing contract: `resources[].binding = "DB"` per module becomes one
D1 per service Worker in `service` mode, instead of one shared D1 in `embedded` mode.

## Decisions

### Decision 1 — Topology: embedded default, service opt-in
One module contract, two deploy modes selected per app, not hardcoded.

| Mode | Workers | D1 | Comms | Use when |
|------|---------|-----|-------|----------|
| `embedded` (default) | 1 Worker, module routers mounted | 1 D1, table-prefixed per module | in-process function call | small apps, MVP, low traffic |
| `service` (opt-in) | 1 Worker per module | 1 D1 per module | service-binding RPC + JWT, or Queue event | scale, ownership split, independent deploy/versioning |

The same module source is used in both modes. Codegen selects the wiring. The mode is
recorded in the app's `microservices.lock.json` / template config as `deploy.mode`.

Rationale: matches the existing "simple runtime first" principle in
`04-cloudflare-architecture.md`. Splitting is justified by real usage
(startup size, ownership boundaries, traffic), not by default.

### Decision 2 — Identity token: short-lived EdDSA JWT (asymmetric)
Service bindings prove which Worker called. They do not prove which end-user actor
called or what scope was granted. A short-lived signed token carries that.

- A new `auth` module (already referenced as `optional` in `booking/module.json`,
  not yet built) mints an **EdDSA** JWT per inter-service call or per request:
  `{ sub: <actor>, workspace, project, scopes: [...], iat, exp }` with `exp` ~60s.
- **Asymmetric, not shared-secret.** `auth` signs with a private key; every other
  service verifies with the public key, fetched from `auth`'s JWKS endpoint and cached.
  Rationale: with 6+ services a shared HS256 secret means distributing one secret to
  every verifier (large blast radius, painful rotation). With EdDSA the private key
  never leaves `auth`; verifiers hold only the public key.
- The callee verifies the signature and checks `scopes` against its own declared
  `permissions` (`booking.read`, `customer.write`, ...) before executing.
- The private signing key lives in the scoped secret path:
  `workspace/<id>/project/<id>/env/<env>/module/auth/<key-name>`. The public key is
  served from `auth`'s JWKS endpoint (no secret distribution).
- Stateless: no per-call KV/DB lookup, and the same token format works across
  embedded calls, service-binding RPC, and signed queue envelopes.

Rejected alternatives: HS256 shared secret (must distribute the secret to all
verifiers); opaque token + KV lookup (adds a read and state per call); binding-only
with no token (loses end-user actor and per-scope gating).

## Communication Model — three layers

### Layer 1 — Network gate: service bindings (the primary auth)
On Cloudflare, service bindings are private by default. A Worker is invocable
internally only if the caller holds an explicit binding. No public URL, no egress,
in-process on Cloudflare's network, no added latency.

- `embedded` mode: direct binding, e.g. `env.CUSTOMER.getCustomer(...)`.
- `service` mode under Workers for Platforms (namespace `microservices-sh`): caller
  resolves callee by deterministic name through the dispatch namespace binding:

  ```
  const customer = env.DISPATCHER.get(`app_${projectId}_customer_${env}`)
  await customer.getCustomer(id, callerToken)
  ```

  The dispatcher resolves names only within the same tenant/project scope. That scope
  check is the tenant-isolation gate.

Use `WorkerEntrypoint` RPC classes, not `fetch()` with URL strings. Typed methods are
the inter-service contract, generated from each module's `api.schema.json` /
`openapi.json`.

### Layer 2 — Identity gate: JWT scope check
Per Decision 2. The `auth` module provides:

- `mintServiceToken(actor, scopes, ttl)` — caller side.
- `verifyToken(token)` and `requireScope(token, scope)` middleware — callee side.

Gate = service binding (can you reach me) AND JWT scope (are you allowed).

### Layer 3 — Async gate: Cloudflare Queues
Modules already emit domain events (`booking.created`, `customer.updated`, ...). For
fan-out and decoupled side-effects (e.g. send email on booking confirmed), publish a
signed event envelope to a Queue rather than a synchronous call. Producer holds the
queue binding (the gate); the consumer service verifies the envelope signature to
confirm origin.

```
synchronous, need answer now   -> service-binding RPC + JWT scope check
fire-and-forget / fan-out      -> Queue event, signed envelope
```

## Reference Use Case — Booking System
The canonical decomposition. Two of the six services are not normal business
services and that distinction drives the design.

| Service | Public? | Owns D1 | Role | Status |
|---------|---------|---------|------|--------|
| `gateway` | yes — only public Worker | none (KV for rate-limit) | trust boundary: authenticate caller, mint scoped JWT, rate-limit, route via service bindings | to build |
| `auth` | no | users, sessions, keys | sign tokens (private key), serve verify key (JWKS) | to build |
| `customer` | no | customers | `getCustomer`, `upsertCustomer` | exists |
| `booking` | no | services, bookings, slots | core booking; slot lock via Durable Object | exists |
| `payment` | no (+ inbound Stripe webhook) | payments | `createIntent`; holds Stripe secret | to build |
| `audit-log` | no | append-only events | pure async event sink | to build |
| `email` | no | — | async notifications | exists |
| `webhook-delivery` | no | delivery log | outbound signed webhooks to external apps | to build (see External Integration) |

`booking/module.json` already lists `auth`, `audit-log`, `payment-stripe`, `email`
as `optional` — the contract anticipated this decomposition.

### Two special roles
- **`gateway` = trust boundary.** The only Worker with a public URL. Everything else
  is private behind service bindings. The gateway authenticates the human once, mints
  the short-lived scoped JWT, then fans out. Holds zero business data.
- **`audit-log` = pure event sink.** Subscribes to all domain events via Queue,
  append-only. Never on the synchronous path — auditing must not block or fail a
  booking. This is the textbook async case.

### Booking flow — where each gate sits
```
client --HTTP+session--> GATEWAY
  gateway: verify session (auth JWKS, local) | rate-limit
           mint JWT{sub, scopes:[booking.write, customer.read, payment.write], exp~60s}
  |
  +--RPC--> BOOKING.createBooking(payload, jwt)        [verify booking.write]
  |            +--RPC--> CUSTOMER.getCustomer(id, jwt)  [verify customer.read]  sync
  |            +-- slot lock (Durable Object)
  |            +--RPC--> PAYMENT.createIntent(amt, jwt) [verify payment.write]  sync
  |            +-- write pending booking | emit booking.created --> Queue
  |
Stripe --webhook--> PAYMENT | emit payment.succeeded --> Queue                  async
  BOOKING consumes payment.succeeded | confirm | emit booking.confirmed --> Queue
  EMAIL consumes booking.confirmed | send
  AUDIT-LOG consumes *.* | append
```

### Communication matrix
| From -> To | Mode | Why |
|-----------|------|-----|
| gateway -> any | sync RPC | gateway is the caller, mints JWT |
| booking -> customer | sync RPC | need customer data now |
| booking -> payment | sync RPC | need intent now |
| payment -> booking | async event | decouple — don't let the confirm cascade block payment |
| any -> email | async event | side-effect |
| any -> audit-log | async event | never block the business path |

Rule: **sync when you need the answer, async for everything downstream.**

## External Integration — app not on Cloudflare, or not on our account
Service bindings only work inside one Cloudflare account. When the consuming app is
external (Vercel/AWS/Rails/mobile) or on the user's own CF account, the internal mesh
cannot reach it. The internal design is untouched; the boundary promotes the gateway
to a real public API edge and adds an outbound mirror of the event bus.

```
                       OUR ACCOUNT (private mesh)
  EXTERNAL APP        +-----------------------------------------------+
  (Vercel/AWS/        |  GATEWAY --RPC(service binding)--> auth/cust/ |
   Rails/mobile) --HTTPS--^   |                            booking/.. |
        ^             |   |   +-- mint internal short-lived JWT        |
        |  signed     |                                               |
        |  webhook    |  webhook-delivery <--Queue-- domain events     |
        +-------------+--(HMAC + retries)                             |
                       +-----------------------------------------------+
```

### Inbound — external app calls us
External callers cannot hold an internal JWT, so a machine credential is exchanged at
the gateway for the internal JWT:

- **API key per tenant** (hashed at rest, scoped, rotatable) — reuse the scoped API
  keys from `21-auth-first-account-and-cli-plan.md` / `22-product-billing-cli-admin-portal.md`.
  Gateway maps key -> granted scopes -> mints the ~60s internal JWT -> fans out.
- Browser calls from their frontend must not expose the API key. Either they proxy
  through their own backend, or the gateway issues a publishable session token via a
  login endpoint (their user -> our customer).
- Edge concerns: **idempotency keys** (public-network retries), per-key **rate
  limit / quota**, CORS for their domain.
- Later: OAuth2 client-credentials for formal partners.

### Outbound — we notify the external app
The external app is not on our Queue, so internal events cannot reach it. Mirror the
event bus externally with `webhook-delivery`:

- Consumes domain events from the Queue, HTTP POSTs to the tenant's registered
  endpoint, **HMAC-signed (per-tenant secret) + retries + idempotency id**.
- External twin of Layer 3: `booking.confirmed` internally -> Queue -> email/audit
  *and* -> webhook-delivery -> the external server.

### Identity mapping
External users are not our customers. `customer.upsertCustomer({ external_id, ... })`
namespaced per tenant maps the external app's user id to our customer record.

### Two integration topologies
| Mode | Services run in | External app reaches us via | Use when |
|------|-----------------|-----------------------------|----------|
| Hosted / API (recommended default) | our account | public gateway API + webhooks + server SDK | app is anywhere, not on CF — we are a SaaS API to them |
| BYO Cloudflare | the user's CF account (we deploy the mesh in) | service bindings if their app is on CF, else still the public gateway | data residency / own account / own billing |

In Hosted / API mode the whole decomposition is invisible to the consumer: they see
one gateway REST API, signed webhooks, and a typed server SDK. BYO remains deferred
per `04-cloudflare-architecture.md`.

## Folder Structure
Keep module **source** authoring identical regardless of deploy mode; only the
**generated app** layout differs. The CLI vendors module source, so a clean module
package shape is what keeps both modes generatable from one source.

### Module package (source of truth, in this repo)
Matches the existing `modules/customer` shape, plus one RPC file:
```
modules/<id>/
  module.json              # contract: resources, permissions, requires, optional,
                           #           events, hooks, + new: rpc, class
  package.json
  openapi.json
  src/
    index.ts               # public exports
    manifest.ts config.ts permissions.ts resources.ts events.ts
    rpc.ts                 # NEW: WorkerEntrypoint class + method->scope map
    ports.ts types.ts schemas.ts hooks.ts
    use-cases/
  migrations/0001_<id>.sql
  schemas/                 # config/events/hooks/api JSON Schemas
  README.md README.agent.md llms.txt
  microservices.check.mjs
```

### Generated app — `embedded` mode (default)
One Worker; the gateway is the root Hono app with auth middleware; module routers
mounted; one table-prefixed D1:
```
my-app/
  microservices.lock.json     # deploy.mode: "embedded"
  microservices.config.json
  wrangler.jsonc              # one Worker, one D1 binding, one KV
  schema.sql                 # all module migrations, table-prefixed
  src/
    index.ts                 # gateway root: Hono app + auth middleware + router mounts
    middleware/              # auth-verify, rate-limit, request-id
    modules/                 # vendored module source (user-modifiable)
      auth.ts customer.ts booking.ts payment.ts audit-log.ts
  docs/modules/
  migrations/
```

### Generated app — `service` mode (opt-in)
One Worker + one D1 per service; shared contracts package for cross-service types:
```
my-app/
  microservices.lock.json     # deploy.mode: "service"; per-module worker + d1 map
  microservices.config.json
  services/
    gateway/
      wrangler.jsonc          # public route; service bindings to all; queue producer
      src/index.ts            # routes, M2M auth (API key -> JWT), JWT mint
    auth/
      wrangler.jsonc          # own D1 AUTH_DB; JWKS endpoint
      migrations/  src/{index.ts, rpc.ts}
    customer/   { wrangler.jsonc, migrations/, src/{index.ts, rpc.ts} }
    booking/    { ... + Durable Object for slot lock }
    payment/    { ... + Stripe secret, inbound webhook route }
    audit-log/  { wrangler.jsonc, migrations/, src/index.ts (queue consumer, append-only) }
    email/      { src/index.ts (queue consumer) }
    webhook-delivery/ { wrangler.jsonc, migrations/, src/index.ts (queue consumer, outbound HMAC) }
  packages/
    contracts/               # shared: generated RPC client types, JWT claims,
                             #         event-envelope schema, scope constants
  docs/
```

Each `services/<id>/` is an independently deployable Worker with its own
`wrangler.jsonc`, migrations, and D1. `packages/contracts/` is the only shared code
and contains types/schemas only — never business logic or DB access.

### Managed (Hosted / API mode)
Nothing is added to the consumer's repo. Services are installed into a managed
control-plane project; the consumer receives the gateway URL, an API key, and the
server SDK package to import into their existing app.

## CLI Behavior — installing modules and templates
Install is not `npm install`. It is **plan-first, approval-gated, source-vendored,
lock-tracked** codegen, grounded in `planAddModule` (`packages/sdk-internal/src/index.js`)
and `packages/cli`. The plan/approve/apply/check loop is unchanged; topology adds one
branch.

### Current flow (keep)
1. `microservices add <module> --plan` returns a plan and **mutates nothing**:
   resolves `requires` (`missingDependencies`), sets `approvalRequired` when
   `risk=high` OR the module has secrets OR `status != available`, and lists
   `requiredSecrets / requiredResources / requiredPermissions` and `filesLikelyTouched`.
2. Agent reviews the plan with the user; approval gates fire for migrations, PII,
   secrets, production.
3. Apply vendors module **source** (user-modifiable), updates `microservices.lock.json`
   (id + version + customization policy: config / hooks / overlays / forks),
   `microservices.config.json`, `wrangler.jsonc`, `schema.sql`, `src/index.ts`, docs.
4. `microservices check` validates.
5. `compose <template>` resolves a module bundle; `generate --out <dir>` scaffolds the
   whole app. All commands emit stable `--json`. Registry/discover are read-only.

Dependency resolution, approval gates, vendored (modifiable) source, and version
pinning already exist — this is the "pre-built + modifiable" surface.

### New: `--mode` branch in `planAddModule`
The plan reads `deploy.mode` (and the module's new `rpc` contract field) and branches
what it generates:

| | `embedded` (today) | `service` (new) |
|---|--------------------|-----------------|
| `filesLikelyTouched` | `src/modules/<id>.ts`, shared `schema.sql`, root `wrangler.jsonc` | `services/<id>/` dir, own `migrations/`, own `wrangler.jsonc`, service-binding entry in callers, `packages/contracts/` types |
| D1 | append table-prefixed to shared D1 | plan a **new D1 resource** (provision step) |
| wiring | mount router in `src/index.ts` | scaffold `WorkerEntrypoint` RPC class + JWT-verify middleware (from `auth` JWKS) + register `rpc` methods |
| lock entry | `{ id, version }` | `{ id, version, mode: "service", worker, d1 }` |

Examples:
- `add booking` still auto-flags `customer` via `requires`; `auth` / `payment` /
  `audit-log` surface as `optional` prompts.
- `add payment --mode service` plans: create D1 `payment`, scaffold `services/payment/`,
  add service binding `PAYMENT` to gateway, register Stripe secret (approval gate fires
  — it has secrets).
- `add gateway` wires public routes + service bindings to every installed service +
  the API-key -> JWT exchange.
- `add webhook-delivery` wires the Queue consumer + outbound HMAC (the external leg).

### Install target — repo vs managed
- **Repo install** (default for own codebase / BYO): vendors into the user's repo as
  above.
- **Managed / Hosted-API install** (external app not on CF): the same `add` / `compose`
  commands target a managed control-plane project; nothing is written to the consumer's
  repo. The CLI returns the gateway URL, API key, and server SDK reference.

## Contract Changes
Add to the module contract (`packages/module-contract`, `module.json` schema):

- `rpc`: declared inter-service methods this module exposes, each with the scope
  required to call it. Drives `WorkerEntrypoint` class + typed client codegen.
- `deploy.mode` at app level (`embedded` | `service`) in `microservices.lock.json`;
  per-module `{ mode, worker, d1 }` map for `service` mode.
- `class` already exists (`vertical` on booking); add `platform` for `gateway` /
  `auth` and `sink` for `audit-log` / `webhook-delivery` so codegen knows the special
  roles (public edge, signer, pure async consumer).
- `events[]` already exists; map each to optional producer/consumer queue bindings
  for `service` mode.

No changes needed to `permissions[]`, `resources[]`, `requires[]`, `optional[]` — they
already express everything the topology and auth layers need.

## Build Order
1. `auth` module — EdDSA mint/verify + JWKS endpoint + `requireScope()` middleware.
   Unblocks Layer 2. Reuse scoped keys from `21-auth-first-account-and-cli-plan.md`.
2. `rpc` contract field + codegen — `WorkerEntrypoint` class + typed client per module
   from `api.schema.json`; add `rpc` and `class` to the module schema.
3. `--mode` branch in `planAddModule` + lock-file extension (`deploy.mode`, per-module
   `{worker, d1}`). Both modes generatable from the same vendored source.
4. Per-service D1 provisioning — extend `deploy provision` / `deploy bind` to create
   one D1 per module when `deploy.mode = service` (control plane already provisions D1).
5. Dispatcher routing by `app_<project>_<module>_<env>` with the intra-tenant
   resolution gate (naming already specified in `04-cloudflare-architecture.md`).
6. Queue event bus — map `events[]` to producer/consumer bindings with signed envelopes;
   build `audit-log` as the first pure-sink consumer.
7. `gateway` module — public edge: session + API-key (M2M) auth, JWT mint, rate-limit,
   service-binding fan-out. Trust boundary for both internal and external callers.
8. `payment` module — `createIntent` RPC, Stripe secret, inbound webhook, emits
   `payment.succeeded/failed`.
9. External integration — `webhook-delivery` (signed outbound + retries), gateway
   API-key -> JWT exchange + idempotency + per-key quota, `external_id` on `customer`,
   public server SDK.

Net-new work: the `auth`, `gateway`, `payment`, `audit-log`, `webhook-delivery`
modules; the `rpc` + `class` contract fields and codegen; the `--mode` branch; and
per-service provisioning in the deploy adapter. Everything else reuses existing
contract fields and the existing plan/approve/apply/check CLI loop.

## Implementation Status
- **Step 1 done** — `modules/auth/` prototyped (EdDSA mint/verify/JWKS/rotate, scope guard,
  D1 + memory adapters, neutral RPC descriptor). tsc + spec check + runtime roundtrip green.
- **Step 3 done** — `planAddModule` takes `--mode embedded|service` (rejects others with
  `INVALID_DEPLOY_MODE`), branches `filesLikelyTouched`, emits a `deploy` descriptor
  (worker, d1Binding, serviceBindingCallers, rpc) and a `lockEntry`, and gates service
  mode behind approval. `createModuleLock` now writes top-level `deploy.mode`, per-module
  `mode`, and `rpc` in each contract block. CLI `add` passes `--mode`.
- **Contract reconciled (lock drift fixed)** — the canonical `module-contract` `auth`
  entry, the SDK catalog, `docs/modules/catalog.json`, `docs/modules/auth.md`, both
  template locks (`templates/booking-sveltekit` + the create-package copy), the booking
  template `package.json` dep, and `modules/customer` consumed events all now match the
  real auth module (permissions `auth.mint/verify/admin`, events `auth.token_minted/
  key_rotated`, secret `AUTH_SIGNING_KEY`, class `platform`). auth is vendored into the
  create package template. `pnpm spec:check:all` + `pnpm test:create` green.
- **Step 2 done** — `packages/sdk-internal/src/rpc-codegen.js` generates, from a module's
  `rpc` contract: (a) the callee `WorkerEntrypoint` subclass (verifies caller token —
  locally for auth, via the `AUTH` binding for others — and enforces per-method scope
  before running the use case), and (b) the caller-side typed client + dispatcher
  resolver (`get<Module>Service`). Modules without an rpc contract return null. The auth
  entrypoint + client typecheck against the real `modules/auth` package. Exposed from the
  SDK as `generateRpcEntrypoint` / `generateRpcClient`. Module `rpcContract` handlers were
  normalized to a uniform `(input, deps)` signature so dispatch needs no per-method casing.
- **Old auth runtime retired** — the Hono app generator no longer emits the passwordless
  signup runtime. `buildAuthModuleTs` now generates token routes (`POST /auth/tokens`,
  `/auth/tokens/verify`, `/auth/keys/rotate`, `GET /auth/.well-known/jwks.json`) backed by
  a generated `src/lib/jwt.ts` (EdDSA via WebCrypto, signing-key store, mint/verify/jwks/
  rotate). Schema dropped `users` for `signing_keys`; `customers.user_id` → `external_id`
  (plans/24 identity mapping); `beforeSignup` hook → `beforeMintToken`; no more
  `auth.user_created`. Generated app typechecks; a runtime smoke of the generated
  `jwt.ts` (mint→verify→jwks→rotate→tamper) passes. `pnpm test:create` green.

- **Step 7 done** — `modules/gateway/` built: the public trust boundary. Use cases
  `createApiKey` (admin; SHA-256-hashed at rest, raw shown once), `verifyApiKey`, and
  `issueToken` (the inbound exchange: authenticate API key → rate-limit → narrow scopes
  to the key's grant → mint via auth). Ports `ApiKeyStore` / `RateLimitStore` /
  `TokenMinter` with D1, KV, memory, and auth-backed minter adapters
  (`createLocalTokenMinter` embedded, `createBindingTokenMinter` service). The gateway
  never signs — it delegates to auth. `requires: ["auth"]`, `class: platform`, risk high,
  `rpc: []` (it is the caller/edge, not an RPC callee). Registered in the contract
  registry + file catalog + `docs/modules/gateway.md`. Platform-class modules now derive
  `approvalRisk: high` in the SDK (so gateway + auth are approval-gated). Verified: tsc
  clean, spec:check:all (6 targets), and a full gateway↔auth integration smoke
  (createApiKey → issueToken → real EdDSA token verified by auth → scope-narrowing 403 →
  unknown-key 401 → rate-limit 429) all pass. `pnpm test:create` green.
- **Gateway wired as front door (booking-business generator)** — added `gateway` to the
  `booking-business` template default modules; the generated Hono app now mounts auth +
  gateway publicly and gates every business route (`/customers`, `/bookings`) behind a
  `requireToken` middleware that verifies the EdDSA token via `src/lib/jwt`. New generated
  files: `src/lib/gateway.ts` (API-key hash/create/verify, KV rate limit, scope-narrowed
  `issueToken` that mints via the auth token lib) and `src/modules/gateway.ts`
  (`POST /gateway/tokens` public exchange, `POST /gateway/keys` gated by `gateway.admin`).
  Schema adds `api_keys`; Env + wrangler add `RATE_LIMIT_KV`. Verified: generated app tsc
  clean and a full `app.fetch` smoke (no token → 401, rotate key → exchange API key for
  token → token opens business route 200, bad token → 401, admin key creation gated) all
  pass. `pnpm test:create` + `spec:check:all` green.
- **Gateway wired into the `booking-sveltekit` create template** — `hooks.server.ts` is
  the front door: it provisions auth/gateway stores (D1/KV, memory fallback) + a local
  token minter, and gates every `/api/*` route behind a `verifyToken` check (except the
  public exchange, JWKS, and a self-disabling first-run bootstrap). New routes:
  `/api/gateway/tokens` (exchange), `/api/gateway/keys` (`gateway.admin`-gated),
  `/api/auth/jwks`, `/api/auth/bootstrap`. Migration `0004_auth_gateway.sql`
  (signing_keys + api_keys), `RATE_LIMIT_KV` binding, gateway added to template
  lock/manifest/deps and vendored by the create build. Verified: `vite build` succeeds and
  a 9-check live `vite dev` + local-D1 curl smoke passes (no token→401, bootstrap→key,
  bootstrap self-disable→403, exchange→token, token opens `/api/*`→200, bad token→401,
  JWKS→200, admin key create 201 with / 403 without `gateway.admin`). `spec:check:all` (6)
  + `test:create` green. Service-mode root routing + service-binding fan-out remains step 4.

- **Step 4 done (resource plan + binding generalization)** — `planDeploymentResources`
  (SDK, exported; CLI `deploy plan-resources [template] [--mode embedded|service]`) is the
  mode-aware provisioning plan. Embedded → one Worker + shared `DB` + all KV namespaces.
  Service → one Worker + one D1 per module (`AUTH_DB`/`GATEWAY_DB`/`CUSTOMER_DB`/
  `BOOKING_DB`), each module's own KV, plus the service bindings each caller needs
  (gateway→AUTH, customer→AUTH, booking→AUTH+CUSTOMER). The control plane provisions from
  `resources`; `deploy bind` rewrites per worker. Also fixed a real gap from the gateway
  step: the SvelteKit project CLI bound only `DB`+`CACHE_KV`, so `RATE_LIMIT_KV` was
  unbindable — `preview doctor` now checks every KV namespace and `preview bind` accepts
  `--rate-limit-kv-id` (and resolves all KV bindings, surfacing any unresolved). Verified:
  plan output correct for both modes + invalid-mode rejected; project-CLI doctor flags
  RATE_LIMIT_KV and bind resolves it; `spec:check:all` (6) + `test:create` green.
  Follow-up: actually generating the service-mode app (per-service `services/<id>/` Workers
  + own `wrangler.jsonc`) is the remaining piece before `--mode service` deploys end-to-end;
  the plan + binding adapter are now ready for it.

- **Step 6 (partial) done — `audit-log` module** built at `modules/audit-log/`: the pure
  event sink (plans/24). `recordEvent` (append-only), `consumeEvent` (queue consumer that
  verifies a signed envelope before recording), `listEvents` (`audit.read`). `AuditEventStore`
  port + D1/memory adapters. `src/envelope.ts` signs/verifies queue envelopes with
  HMAC-SHA256 (layer 3). `class: sink`, `rpc: []`, never on the synchronous path. Promoted
  from a planned stub to a real contract module (removed the SDK planned-doc duplicate);
  reconciled the file catalog + `docs/modules/audit-log.md`; added as a vendored dep of the
  booking-sveltekit template (it was already `required` there). Verified: tsc clean, an
  8-check runtime smoke (record / reject-bad-input / list / sign / consume-signed /
  reject-tampered / consume-without-secret / full-trail) all pass, `spec:check:all` (8) +
  `test:create` green. The Cloudflare Queues producer/consumer bindings (the transport) and
  wiring audit-log into the booking-business Hono app remain; the module + envelope contract
  are ready for them.

- **Step 8 done — `payment` module** built at `modules/payment/` (canonical id `payment`,
  replacing the old `payment-stripe` planned stub). Provider module: `createPaymentIntent`
  (RPC, `payment.write`) creates an intent via a `PaymentGateway` port + records a pending
  payment + emits `payment.checkout_created`; `handleWebhook` verifies a Stripe-style
  HMAC-SHA256 signature (constant-time) then marks succeeded/refunded/failed + emits the
  matching event; `getPayment` / `listPayments` (`payment.read`). Ports: `PaymentRepository`
  (D1 + memory) and `PaymentGateway` (`createStripePaymentGateway(secret)` real fetch +
  `createMemoryPaymentGateway()` for tests — tests never call Stripe). Secrets
  `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`; the SDK catalog now surfaces module secrets
  from the contract (`module.secrets`), and provider class → `approvalRisk: high`. `rpc`
  contract + `payment` `SERVICE_SPECS` entry (verify "binding"). Normalized all functional
  `payment-stripe` references to `payment` (contract optional lists, booking module.json,
  template manifest, workspace-tools scaffold default, create smoke). Verified: tsc clean,
  a 7-check runtime smoke (createPaymentIntent / invalid-input / signed-webhook→succeeded /
  tampered-sig / tampered-body / refund / getPayment), payment rpc codegen entrypoint+client
  typecheck against the real package, `spec:check:all` (9) + `test:create` green.

- **Step 9 done — `webhook-delivery` module** built at `modules/webhook-delivery/`: the
  outbound mirror of the event bus (External Integration). `registerEndpoint`
  (`webhook.write`, generates a per-endpoint signing secret returned once); `deliverEvent`
  fans an event to active matching endpoints — HMAC-signs the body (`src/signing.ts`,
  HMAC-SHA256), POSTs via an injected `HttpClient` with `X-Signature` + `X-Idempotency-Id`,
  logs the attempt (delivered/failed; non-2xx = failed), emits `webhook.delivered` /
  `webhook.failed`; `listDeliveries` (`webhook.read`). Ports: `WebhookEndpointStore`,
  `DeliveryLogStore`, `HttpClient` (`createFetchHttpClient()` + `createMemoryHttpClient()` —
  tests make no real network call). `class: sink`, `rpc: []`, `approvalRisk: high` (external
  side-effects). Added to contract MODULES + catalog + `docs/modules/webhook-delivery.md` +
  booking-sveltekit `optional` (no forced template dep). Verified: tsc clean, a 16-check
  runtime smoke (register / invalid-url / signed-delivery / signature-verify / wrong-secret /
  500→failed / log / non-subscribed), `spec:check:all` (9) + `test:create` green.

- **Step 2 extended — `customer` + `booking` rpc contracts** added (`src/rpc.ts` + `./rpc`
  export + `module.json` rpc + contract rpc + `SERVICE_SPECS`). customer exposes
  `getCustomer` / `listCustomers` / `upsertCustomer`; booking exposes only its OWN-data
  methods `listBookings` / `getBooking` / `getAvailability`. `createBooking` is intentionally
  NOT exposed over RPC and booking's service entrypoint has no `customerRepository` dep —
  in service mode booking must call customer via an RPC-backed port (service-scoped D1 rule);
  that cross-service wiring is DEFERRED (documented in `modules/booking/src/rpc.ts`).
  Verified: customer + booking rpc codegen entrypoints+clients typecheck against the real
  packages (temp-dir + symlink + tsc), `spec:check:all` (9) + `test:create` green.

- **Step 6 (transport) done — Queues event-bus wiring** in the booking-business Hono
  generator. Added an `EVENTS` Queue producer + consumer to the generated `wrangler.jsonc`
  and `Env` (`EVENTS?: Queue`, `EVENT_BUS_SECRET?`), a generated `src/lib/events.ts` that
  signs envelopes (HMAC-SHA256, same wire format as the audit-log envelope) and publishes to
  the queue (`publishEvent`, no-op when EVENTS is unbound) and verifies + routes consumed
  envelopes to the audit sink (`consumeEvent`), and changed the Worker default export to
  `{ fetch, queue }` so the consumer drains the batch into `writeAudit`. Verified: the
  generated booking-business app typechecks (generate → temp `generated/_verify` → symlink
  hono + workers-types → tsc; deleted after), a runtime smoke of the generated `events.ts`
  (sign / verify / wrong-secret / publish-signed / consume→audit / drop-tampered /
  unbound-noop) passes, `spec:check:all` (9) + `test:create` green. Note: the producer side
  is wired in the lib but the business modules don't yet call `publishEvent` on each domain
  event — that per-route emit call-site wiring is a small follow-up; the transport + signed
  envelope + audit consumer are complete and verified.

- **Step 5 done (codegen) — service-mode app generation**. `generateServiceProject(input)`
  (SDK, exported + on the client) emits, for `deploy.mode = service`: per-service
  `services/<id>/` Workers — RPC-callee modules (auth, customer, booking, payment) get the
  generated `WorkerEntrypoint` from `generateRpcEntrypoint` with a per-service `src/env.ts`
  (own `*_DB` D1, `AUTH` verify binding, callee service bindings, `STRIPE_SECRET_KEY` for
  payment); gateway gets an HTTP fetch edge Worker. Each service has its own
  `wrangler.jsonc` (`app_<project>_<id>_<env>`, own D1 `<ID>_DB`, dispatch namespace
  `microservices-sh`, service bindings to AUTH + declared deps) and migrations dir. A shared
  `packages/contracts/` holds the generated RPC clients (`generateRpcClient`) + a barrel.
  The root `microservices.lock.json` carries `deploy.mode: "service"` + a per-service
  descriptor. Reuses `planDeploymentResources` for the resource map. Verified: the full
  service-mode tree TYPECHECKS — all 5 generated workers (auth/customer/booking/payment RPC
  entrypoints + gateway HTTP edge) compiled with tsc against the real `@microservices-sh/*`
  packages + workers-types (generate → temp `generated/_verify_svc` → symlink → tsc per
  service; deleted after). `spec:check:all` (9) + `test:create` green. DEFERRED within this
  step: vendoring real module source into each service (migrations are placeholders that point
  at `modules/<id>/migrations`), the gateway HTTP edge's actual fan-out call bodies (the
  fetch worker is a health/echo skeleton), and a CLI `generate --mode service` surface.

## Non-Goals
- BYO Cloudflare mode for split services (defer per `04-cloudflare-architecture.md`);
  Hosted / API mode is the default path for external apps.
- Cross-tenant service calls (explicitly disallowed; dispatcher scope gate prevents it).
- Cross-service D1 access (services share only `packages/contracts/` types, never tables).
- Replacing in-process embedded calls with RPC for small apps (unnecessary overhead).
- Exposing any service other than `gateway` (and `payment`'s Stripe webhook) publicly.
