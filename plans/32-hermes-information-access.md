# Plan 32 — Hermes Information Access for Operational Assistance

*Status: spec (2026-06-20). Comprehensive review of what the Hermes agent must be able to *read* to actually assist a company's operations. Extends [Plan 28](28-fly-runtime-graphrag-agent.md) (runtime) and [Plan 31](31-hermes-graphify-ingest.md) (knowledge ingest, built).*

## Thesis

Operating a company ≠ answering from a folder of markdown. Plan 28/31 give the agent a **knowledge graph over static files** — good for "what is our refund policy", useless for "which of ACME's invoices are overdue". An operational assistant needs **three source classes across two retrieval planes, under one governance model**. Today only the knowledge plane exists. This plan specifies the rest.

The hard constraint that shapes everything: the 25+ operational modules (booking, customer, invoice, support-ticket, calendar-google, jobs-workflows, …) live on the **Cloudflare operate plane (D1)**. The Hermes agent runs on a **Fly machine** and *cannot read CF D1 directly*. So live operational data needs a **governed read-back channel**, not graphify.

## Implementation status (2026-06-20) — P1 domain layer built

- ✅ **Governed ops-read primitive** — `modules/research/src/ops.ts` `opsRead({tool,args}, {client, actor, now, registry?, audit?})`. Fail-closed: unknown tool → `OPS_TOOL_UNKNOWN`, missing scope → `OPS_FORBIDDEN`, both **without calling the transport** and **audited as `ops.read_denied`**. Authorized reads are owner-scoped, audited (`ops.read`), and returned as cited `Passage`s (`sourceFile = module:entityId`, `sourceLocation = as-of <iso>`) so operational facts flow through the same cite-or-refuse synthesis path as graph knowledge.
- ✅ **Read-tool registry** — `DEFAULT_OPS_TOOLS`: customer / invoice / booking / support-ticket / calendar (least-privilege per-tool scopes).
- ✅ **Read-back transport (client)** — `modules/research/src/adapters/operate-http-client.ts` `createOperateHttpClient({baseUrl, serviceToken, fetch})`. POSTs `/<base>/ops/<tool>` with `Bearer <service-token>` + `X-Owner-Id`, maps `{records}` → `OpsRecord[]`, throws on non-2xx. fetch injected.
- ✅ **Operate-plane server handler (trust boundary)** — `modules/research/src/ops-server.ts` `handleOpsRequest({tool, token, ownerHeader, args}, {registry, verifier})`. Verifies the service token → its bound `ownerId`; **scopes the read by the token's owner, never a client-supplied value**; rejects a mismatched `X-Owner-Id` (`OPS_OWNER_MISMATCH` — no cross-tenant read); enforces the tool's scope server-side; dispatches `tool → module read use-case` via injected handlers. Mounted by the client's **deployed operate app** (which holds the operational D1 — the control-plane api does NOT).
- ✅ **HTTP mount (Fetch adapter)** — `modules/research/src/ops-http.ts` `createOpsHandler({registry, verifier})` → `(Request) => Response`. Parses `POST /ops/:tool` (Bearer token, `X-Owner-Id`, `{args}` body), delegates to `handleOpsRequest`, encodes the response; 405 non-POST, 400 bad body. One-line mount in any Worker/SvelteKit operate app.
- ✅ **Per-tenant scoped token** — `modules/research/src/ops-token.ts` `mintOpsToken({ownerId, scopes, exp}, {secret})` + `createOpsTokenVerifier({secret, now})` (the latter *is* an `OpsTokenVerifier`, drops straight into `handleOpsRequest`). Stateless HMAC-SHA256 (Web Crypto, Workers+Node), constant-time compare, per-tenant secret (leak blast-radius = one client, rotatable). Control plane mints → Fly secret on the machine → operate app verifies. Tested incl. tamper/wrong-secret/expiry + a mint→`handleOpsRequest` round-trip.
- ✅ **Generated operate app exposes `/ops` (real)** — `templates/booking-sveltekit/src/routes/ops/[tool]/+server.ts`: a SvelteKit POST route that assembles the shipped pieces — `createOpsTokenVerifier(OPS_VERIFY_SECRET)` + `createOpsRegistry` binding the template's `getCustomer`/`listBookings` (its two modules) via the `to*Record` mappers + `createOpsHandler`. `App.Platform.env.OPS_VERIFY_SECRET` declared. svelte-check clean for the route; template spec check passes. A generated booking app now serves the read-back endpoint out of the box.
- ✅ **Fly runtime blends (go-live wiring)** — `packages/research-agent-runtime`: `bootResearchRuntime` gained an optional `opsClient` + an `assist()` method (blended `assistedBrief`); `server.ts` builds the `opsClient` from `OPERATE_APP_URL`+`OPS_TOKEN` Fly secrets and serves `POST /assist` (RUNTIME_TOKEN-authed, owner-scoped actor carries the 5 ops read scopes). Absent secrets ⇒ `/assist` stays graph-only. 8 runtime tests (incl. a blended read-back), tsgo clean. This is the agent side calling the operate app's `/ops`.
- ✅ **Question→tool planner + blended brief (P4)** — `modules/research/src/ops-plan.ts` `planOpsTools(question)` (deterministic keyword router → which ops tools a question implies; knowledge-only ⇒ `[]`, with guards so "refund policy"/"onboard a client" don't false-trigger) and `modules/research/src/assist.ts` `assistedBrief({question}, deps)` — gathers graph (knowledge) + ops (live) passages, one cite-or-refuse brief grounded in BOTH planes, returns `{planes:{graph,ops}}`. Pure-knowledge questions never touch ops; unscoped ops tools are skipped best-effort, not fatal. 10 tests.
- ✅ **Operate-app registry + record mappers** — `modules/research/src/ops-registry.ts`: `OPS_TOOL_SCOPES` (canonical tool→scope, one place), `createOpsRegistry(handlers)` (attaches scopes, rejects unknown tool names), and `to{Customer,Invoice,Booking,Ticket,Calendar}Record` mappers — the canonical "operational record → cited evidence" logic (entity → `OpsRecord` with `module:entityId` citation + as-of). Dependency-injected (structural inputs, no cross-module imports → stays in-bounds). 6 tests incl. a real-shaped customer read dispatched end-to-end through `handleOpsRequest` → cited record. The app injects its real read use-cases + these mappers.
- ✅ **Operational brief (the user-facing payoff)** — `modules/research/src/ops-brief.ts` `operationalBrief({question, tool, args}, deps)`. Mirrors `research()` but grounds on LIVE records: governed `opsRead` → cite-or-refuse (`OPS_NO_SOURCES` / `OPS_UNCITED`) → synthesize → persisted, audited brief whose citations are live record refs (`invoice:inv_42`). Governance refusals propagate (no brief saved). 4 tests.
- ✅ **Shared token codec package (no drift)** — `packages/ops-token` (`@microservices-sh/ops-token`): the canonical `mintOpsToken`/`createOpsTokenVerifier`, zero-dep Web Crypto, **single source of truth** consumed by both the minter and the verifier. A committed **golden vector** locks the wire format (any encoding change fails CI → every issued token would otherwise silently break). `modules/research` now re-exports it (public surface unchanged, 67 tests still green).
- ✅ **Provisioning bridge** — `@microservices-sh/ops-token/provisioning` `planOpsProvisioning({grant, hermesApp, operateApp})` → mints `OPS_TOKEN` from the grant and emits the two operator commands: `fly secrets set OPS_TOKEN=… -a <hermesApp>` (Fly) + `printf … | wrangler secret put OPS_VERIFY_SECRET --name <operateApp>` (Cloudflare). Returns `expiresAt` for rotation scheduling. Runs where the grant secret is available, never on the API response path. 4 tests; minted token verifies with the operate app's verifier. (Package authored as `.js`+`.d.ts` like `connection-contract` so it's consumable by both the bundler/vitest TS modules and the raw-node CLI — no build step.)
- ✅ **Privileged grant endpoint (control plane)** — `getHostedHermesRuntimeOpsGrant` + `GET /agents/hermes/runtimes/:id/ops-grant`. Workspace-scoped reveal of the grant *including the secret* (the deliberate, explicit provisioning path; normal views redact it); `OPS_GRANT_NOT_ISSUED` if absent, `RUNTIME_NOT_FOUND` cross-workspace. api: 188 tests green, tsgo clean.
- ✅ **CLI command** — `microservices agents hermes ops-credentials <runtime-id> --operate-app <cf-worker>`: fetches the grant from the privileged endpoint, runs `planOpsProvisioning`, prints the two operator commands (or `--json`). The mint runs in the CLI (monorepo, bundles the codec) — control-plane api never mints. 4 CLI tests; closes the manual-provisioning loop.
- ✅ **Ops-access issuance at reservation (control plane)** — `api/src/agent-ops-access.ts` `issueRuntimeOpsAccess({ownerId, scopes?, ttlSeconds, now, randomSecret?})` → `{ownerId, scopes, secret, expiresAt}` (default = the 5 read scopes). Wired into `createHostedHermesRuntime`: the grant is recorded in `config_json` (persists for the provisioning adapter) with the **secret redacted from every API response** (`runtimeView` → `opsAccess.secretIssued: true`). Deliberately does NOT mint the token — the codec stays solely in `@microservices-sh/research` so mint/verify can't drift; the provisioning adapter (which bundles research) mints from the grant. api: 186 tests green, tsgo clean.
- ✅ **Round-trip contract test** — `ops-roundtrip.test.ts` wires client⇄server through a fetch to catch path/header/body drift.
- Gates: 57 research tests green (25 new across ops) · tsgo clean · contract check passed. Transport/fetch/stores/verifier all **injected** — exercised against fakes, **not yet against a live operate app**.

### Operate-app composition (the remaining glue — assembled in the app, the composition root)

```ts
// In the client's deployed operate app (where cross-module wiring is legal):
import { createOpsHandler } from "@microservices-sh/research/ops-http";
import { getCustomer } from "@microservices-sh/customer";
import { verifyApiKey } from "@microservices-sh/gateway";

// 1. Verifier: map the gateway's API-key principal → the ops token contract.
const verifier = {
  async verify(token) {
    const res = await verifyApiKey(token, { apiKeyStore });
    if (!res.ok) return { ok: false };
    return { ok: true, ownerId: res.data.principal.subject, scopes: res.data.principal.scopes };
  }
};

// 2. Registry: bind each tool → a module read use-case, owner-scoped, via the
//    shipped builder + canonical mappers (createOpsRegistry assigns the scopes).
import { createOpsRegistry, toCustomerRecord, toInvoiceRecord } from "@microservices-sh/research/ops-registry";
import { getCustomer } from "@microservices-sh/customer";
import { listInvoices } from "@microservices-sh/invoice";

const registry = createOpsRegistry({
  "ops.customer.read": async (args, { ownerId }) => {
    const r = await getCustomer({ id: args.id }, { customerRepository });
    return r.ok ? [toCustomerRecord(r.data.customer, Date.now())] : [];
  },
  "ops.invoice.read": async (args, { ownerId }) => {
    const r = await listInvoices({ customerId: args.customerId, tenantId: ownerId }, { invoiceStore });
    return r.ok ? r.data.invoices.map((inv) => toInvoiceRecord(inv, Date.now())) : [];
  }
  // …booking / support-ticket / calendar — same shape
});

// 3. Mount.
const ops = createOpsHandler({ registry, verifier });
// Worker:   if (url.pathname.startsWith("/ops/")) return ops(request);
```

Everything reusable + tested ships in the module (`createOpsRegistry`, the `to*Record` mappers, `createOpsHandler`, `createOpsTokenVerifier`). The app supplies only its own module read use-cases + stores. Remaining: generate this composition into the operate-app template, and the Fly/CF secret automation.

**Architecture corrected:** operational data lives in the **client's deployed operate app** (service-scoped D1), not the control-plane api (whose D1 is only auth/workspace/billing/runtimes). So the `/ops/<tool>` HTTP route + handler registration belong in the **operate app/gateway**, calling `handleOpsRequest`; the agent reads back into that app, not the control plane.

- ✅ **Fly/CF provisioning automation (clients + orchestration)** — in the api repo, all fetch-injected + tested:
  - `api/src/fly-machines.ts` `createFlyMachinesClient({token, fetch})` — Machines REST (createApp/createVolume/createMachine) + GraphQL `setSecrets` (Fly secrets aren't a Machines-REST endpoint); `provisionHermesMachine(spec, {fly})` sequences app → volume → **secrets-before-machine** → machine, mounts the volume at `/data`. 9 tests.
  - `api/src/cloudflare-secrets.ts` `createCloudflareSecretsClient({accountId, apiToken, fetch})` `putSecret(script, name, value)` — sets `OPS_VERIFY_SECRET` on the operate Worker (the CF half). 3 tests.
  - `provisionHostedHermesRuntime(env, id, {fly, image, openrouterKey, runtimeToken, opsToken?, operateAppUrl?}, ctx)` — loads the reserved row, sets secrets (BYOK + RUNTIME_TOKEN + OPS_TOKEN/OPERATE_APP_URL), boots the machine, marks the runtime **ready** with its machine id; refuses non-`reserved` (`RUNTIME_NOT_PROVISIONABLE`), marks `failed` on error. 2 tests. The `FLY_API_TOKEN` is injected, never stored in this module.
  - `provisionHostedHermesRuntimeWithEnv` + `POST /agents/hermes/runtimes/:id/provision` — builds the Fly + CF clients from env secrets (fail-closed `FLY_NOT_CONFIGURED` if `FLY_API_TOKEN` unset), provisions the machine, and pushes `OPS_VERIFY_SECRET` to the operate Worker (reads the grant secret server-side). Clients injectable for tests. Status mapping: 503/502/409 for the new codes.
  - api: 204 tests green, tsgo clean.

**Still pending for P1 to be live (deployment wiring):**
1. ~~Mount an HTTP `/ops/<tool>` route~~ — ✅ `createOpsHandler` ships; the app drops in the registry + verifier per the composition above (one line to mount).
2. ~~Token + issuance + bridge + privileged endpoint + CLI + Fly/CF automation~~ — ✅ all built. Manual loop (CLI `ops-credentials`) AND automated provisioning (`provisionHostedHermesRuntime` → Fly Machines API + CF secrets) both ship and are tested. Remaining = a thin **provision HTTP endpoint** that injects the real `FLY_API_TOKEN`/CF token + minted OPS_TOKEN into `provisionHostedHermesRuntime` + `putSecret`, the **credentials/image** (operator decision: Fly token ownership + pushing the `research-agent-runtime` image), and a **rotation cron** (30d TTL).
3. ~~Per-module read handlers + registry + template + Fly wiring~~ — ✅ `createOpsRegistry` + mappers ship; the **booking template serves `/ops`** (customer + booking) and the **Fly runtime serves `/assist`** (blended, opsClient from secrets). Remaining = bind the other 3 tools in templates that ship those modules (invoice/ticket/calendar), and the Fly **secret automation** below.
4. Optional **MCP wrapper** so the agent loop discovers these as tools.
5. ~~Wire `opsRead` → a cited brief / planner / blended~~ — ✅ `operationalBrief` + `planOpsTools` + `assistedBrief` (blended graph+ops, P4). Optional later: an LLM planner (vs the heuristic) and entity-arg extraction (NER) so tool args carry ids, not just a query hint.

## 1. Source taxonomy — what "more information" actually means

| Class | Examples | Volatility | Retrieval mode | Lives on | Governance |
|---|---|---|---|---|---|
| **Stable knowledge** | SOPs, policies, product docs, past briefs, decisions | low | **Graph** (graphify batch) | Fly `/opt/data` → `graph.db` | owner-scope, cite-file |
| **Operational records** | bookings, customers, invoices, tickets, calendar, jobs, payments | high | **Live tools** (read operate plane) | CF D1 (the 25 modules) | per-tool scope, audit, owner-scope, as-of |
| **External SaaS** | Google Drive/Gmail/Calendar, CRM, Stripe, Slack/Notion | mixed | **Connector sync** (→ graph) *or* **live tools** | 3rd-party APIs | OAuth secrets, approval-gated |

Rule of thumb: **graph the slow stuff, live-query the fast stuff.** Don't put today's bookings in the graph (stale by the next build); don't make the agent re-derive the refund policy on every call (waste).

## 2. Two retrieval planes (must not be conflated)

- **Knowledge plane** — FTS5 + 1-hop over `graph.db`. Built (Plan 31). Answers *"how do we onboard a client?"*, *"what's our cancellation policy?"*
- **Operations plane** — governed live tool-calls into the operate API. **Missing.** Answers *"what's ACME's open balance?"*, *"who's on the schedule tomorrow?"*

Every retrieved `Passage` is tagged with **source-plane + as-of timestamp**. Briefs say *"per SOP (graphed 2026-06-18)"* vs *"per live invoice record (as of now)"*. Freshness is a first-class trust signal, same family as cite-or-refuse.

## 3. The missing channel — governed operate-plane read-back

```
 Hermes (Fly machine, one client) ──HTTPS, scoped service credential (Fly secret)──▶
   CF operate API ──owner-scoped read use-cases──▶ D1 (customer/invoice/booking/ticket/…)
```

- **Not direct D1** — Fly can't read CF D1; it calls the operate **API** over HTTPS with a per-tenant, scoped service credential issued at provisioning (a Fly secret, rotatable). The operate plane enforces `ownerId` server-side — the machine boundary is *not* trusted for data scope here, the token is.
- **Reuse the ai-gateway governance shape**: fail-closed authz per tool (`ops.invoice.read`, `ops.booking.read`, …), per-tenant rate/budget, **audit every call** (audit-log module), owner-scope.
- **Expose reads as tools.** The modules already ship read use-cases (Customer 360, invoice status, booking schedule, ticket queue). A thin **ops-tools surface** maps `tool → module read use-case`, owner-scoped. Hermes is agentic → an **MCP server** on the operate plane is the natural shape (the project already runs the `superadmin-mcp` pattern; this is the per-tenant, read-only, owner-scoped cousin).
- **cite-or-refuse extends to live data**: a live answer cites the operate record (`module + entityId + as-of`), not a file. No record → refuse.

## 4. Connector sync — external → corpus

- **Stable external docs** (Drive/Notion pages, resolved email threads, handbooks) → connector pulls → normalize to markdown → `/opt/data/sources` → next graphify build ingests them. Same trigger model as Plan 31 (manual/cron).
- **Live external state** (Stripe balance, Google Calendar) → **live tools**, not graph. `calendar-google` is already a module.
- Auth + billing reuse the existing **connector marketplace** pattern (FavCRM/WhatsApp pilot, Connect Option C): OAuth tokens = Fly secrets, **approval-gated**, per-source sync job on cron.

## 5. Retrieval orchestration — how a question routes

```
question ─▶ planner picks plane(s):
   • knowledge-only  ("policy / how-to")      → graph retriever
   • operational     ("this customer / today")→ ops tools
   • blended         ("draft ACME's renewal   → graph (renewal SOP)
                       email from our SOP +      + ops tools (ACME invoices)
                       their invoice history")   → merge
   ─▶ cited Passages ─▶ ai-gateway synth ─▶ cite-or-refuse brief ─▶ decision()
```

Blended is the high-value case — it's what "assist operations" means: combine *how we do things* (knowledge) with *this entity's current state* (operations).

## 6. Governance — expanded surface = expanded risk

- Each source = **explicit scope grant + audit + owner-scope**. New source is never silently reachable.
- **Read-only v1.** No mutations to the operate plane. Writes (create ticket, send email, reschedule) come later, **approval-gated** through `operator-work` + `org-team-rbac`.
- **Residency**: graph + live reads stay inside the client's tenant boundary; external egress only via ai-gateway BYOK + connector OAuth. Token **budget meters live-tool calls too** (each retrieval is a metered, audited event — 429 before overspend).
- The agent gets exactly the scopes the *client's* operator granted — not the platform's. Per-tenant credential, least-privilege tool set.

## 6b. Provisioning security — gates + Fly-token hardening

**Init is gated end-to-end (built + tested).** A tenant cannot cause a billable Fly machine to exist without passing every layer:

| Layer | Reservation | Provision |
|---|---|---|
| Auth (`requireControlPlaneAuth`) | ✅ | ✅ |
| Tenant isolation (workspace-scoped) | ✅ | ✅ (`RUNTIME_NOT_FOUND` cross-workspace) |
| Billing/entitlement | ✅ `enforceHostedHermesGate` | ✅ `enforceHostedHermesBilling` (re-check; entitlement-only, since the reserved slot would otherwise self-block) |
| Quota slot | ✅ counted | held; **reaper** frees abandoned reservations (>1h, status→`deleted`) |
| State (`reserved` only) | — | ✅ `RUNTIME_NOT_PROVISIONABLE` |
| Platform Fly-token present | — | ✅ `FLY_NOT_CONFIGURED` if `FLY_API_TOKEN` unset |
| Internal bypass | ✅ `INTERNAL_WORKSPACE_ID` | ✅ |

**On the `FLY_API_TOKEN` (org-wide) — and why per-tenant token scoping is NOT the right control:**

- The token lives **only in the control plane** (a CF Worker secret); tenants never see it. **Cross-tenant isolation is enforced in the control plane** (workspace-scoped queries + the gates above), *not* at the Fly token.
- **Creating a new app/volume requires org-level privilege** on Fly — app-scoped/deploy tokens manage existing apps but can't create them. So provisioning a new client machine inherently needs an org token; per-tenant tokens cannot avoid that.
- The control plane is the single orchestrator, so one org token vs N per-tenant tokens has the **same blast radius** under a control-plane compromise — per-tenant tokens add management surface without adding isolation.
- **Per-tenant isolation already exists where it matters: the `byo-fly` mode** — the client provisions in *their own* Fly org with *their own* token, which the platform never holds.

**Higher-value hardening for the org token (do these instead of per-tenant scoping):**

1. **Rotation + short TTL** on `FLY_API_TOKEN` (and `OPS_TOKEN`/`OPS_VERIFY_SECRET`, ~30d).
2. **Least-privilege org token** — Fly supports restricted org tokens; scope it to provisioning only (no billing/org-admin).
3. **App-pattern restriction** — limit the token to `*-research-agent` apps so it can't touch arbitrary org resources.
4. **Audit + alerting** on Fly API usage from the control plane (every `provisionHostedHermesRuntime` is already an auditable control-plane action).
5. *(marginal)* app-scoped tokens for post-create lifecycle ops (restart/destroy/secrets), which don't need org privilege.

Most of (1)–(4) is Fly-side credential config, not code. **Decision: do not build per-tenant Fly-token scoping for the hosted tier** (no isolation gain, more surface); harden the single org token via rotation + least-privilege + audit, and rely on `byo-fly` for true infra-level per-tenant isolation.

## 7. Phasing

| Phase | Scope | State |
|---|---|---|
| **P0** | Knowledge plane — graphify ingest | ✅ done (Plan 31) |
| **P1** | Operate-plane **read-back channel** + 3–5 read tools (Customer 360, invoice status, booking schedule, ticket queue, calendar) — **read-only** | next |
| **P2** | Connector sync (Drive/Notion → corpus) + 1 live external (calendar-google) | |
| **P3** | Governed **writes** (draft → approve → act) via operator-work | |
| **P4** | Blended-retrieval planner + freshness-label polish | |

P1 is the unlock — without it the agent literally cannot answer an operational question, which is the entire premium-tier value proposition.

## 8. Open questions

1. **Tool transport** — MCP server on the operate plane (fits Hermes's agentic loop, matches `superadmin-mcp`) vs a REST tool-broker? Lean MCP, per-tenant + read-only + owner-scoped.
2. **Scope granularity** — per-tool (`ops.invoice.read`) vs coarse (`ops.read`)? Lean per-tool for least-privilege + clean audit.
3. **Caching live reads** — staleness window vs operate-plane load. Probably no cache in v1 (correctness > load); revisit.
4. **Graph-vs-live boundary** — some operational data *is* stable knowledge (closed-won deals, resolved tickets as case studies). Decide per entity what graduates into the graph vs stays live.
5. **Credential issuance** — ✅ built: the per-tenant ops token is issued at reservation (`issueRuntimeOpsAccess`) and minted at provisioning. Open: **rotation** (~30d TTL re-mint of `OPS_TOKEN`/`OPS_VERIFY_SECRET`/`FLY_API_TOKEN`). On the org-wide `FLY_API_TOKEN`, see §6b — **per-tenant Fly-token scoping is explicitly NOT pursued** (no isolation gain; harden via rotation + least-privilege + audit; `byo-fly` already gives infra-level per-tenant isolation).
6. **Write safety** (P3) — every mutation behind explicit human approval; idempotency module already exists for safe retries.

## 9. Maps to code

| Concern | Code | State |
|---|---|---|
| Knowledge plane | `modules/research` (+ Plan 31 ingest) | ✅ built |
| Operate read-back / ops-tools | **NEW** — per-tenant read-only MCP over operate read use-cases | design only |
| Governance / egress | `modules/ai-gateway`, `modules/audit-log`, `modules/org-team-rbac` | reuse |
| Live reads (sources) | `customer`, `invoice`, `booking`, `support-ticket`, `calendar-google`, `jobs-workflows`, … | use-cases exist |
| Connector sync | connector-marketplace pattern + per-source cron (Plan 31 trigger model) | pattern exists |
| Writes (P3) | `operator-work`, `org-team-rbac`, `idempotency` | reuse |
| Credential issuance | `api/src/agent-runtimes.ts` (provisioning) | extend |
