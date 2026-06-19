# Plan 28 — Per-Client Fly Runtime for the GraphRAG Research/Advise Agent

*Status: spec (2026-06-19). Implements the runtime for the `research` + `decision` + `ai-gateway` modules built this cycle.*

## Decision

Each client runs on its **own Fly machine** (one tenant per runtime). The machine is the hard tenant boundary; `ownerId` scopes users *within* that client's org. This is the deployment target for the **premium governed-agent tier** (research/advise), distinct from the Cloudflare-native self-serve modules (operate).

**Why Fly, not a Worker, for this tier:** the agent does long, stateful, filesystem-bound work — running `graphify` (a Node+Python batch over the client's files) and holding a SQLite graph on disk. Workers have no persistent FS, are CPU-time-limited, and can't run that batch. A Fly machine has a volume, real compute, and can host a long-running process. (The `operate` modules stay on Cloudflare; this is additive, not a migration.)

## Topology

```
 ┌──────────────────────── Fly machine (one per client) ────────────────────────┐
 │  Volume  /data                                                                 │
 │    /data/sources/**        ← client markdown/files (source of truth)           │
 │    /data/graph.db          ← SQLite: graph_nodes/edges/communities + FTS5,     │
 │                              research_briefs, decision_briefs, decision_logs,   │
 │                              domain_events  (migrations 0001_*)                 │
 │    /data/snapshots/        ← periodic db + sources snapshots (pre-R2-push)     │
 │                                                                                 │
 │  Process: agent runtime (Hermes byo-fly)                                        │
 │    • research()/decision use-cases over SqliteGraphStore + Sqlite*Store         │
 │    • ai-gateway.complete() → OpenRouter/Anthropic adapter (BYOK)                │
 │    • graphify build job (manual | cron | on-upload)                             │
 └───────────────────────────────────────────────────────────────────────────────┘
        │ optional, durable                          │ governed AI egress (BYOK)
        ▼                                            ▼
   Cloudflare R2  (source + db-snapshot backup,   OpenRouter / Anthropic
   own-your-data export; CF app can read for      (keys = Fly secrets)
   citations if a central plane serves briefs)
```

The Cloudflare control plane (D1, billing, `/admin`) remains the system of action for `operate`. R2 is the durable system-of-record + the only thing the CF plane can read (it can't read the Fly disk).

## Storage

- **Source of truth = the Fly volume** (`/data/sources`). R2 is optional off-box backup/export (recommended for durability — Fly volumes are single-machine + snapshot-only).
- **Graph + briefs = local SQLite** (`/data/graph.db`), schema from `modules/research/migrations/0001_research.sql` + `modules/decision/migrations/0001_decision.sql`. FTS5 powers the retrieval entry-point.
- **Driver:** wrap **better-sqlite3** (sync) or **libsql** (async) to the `SqlDatabase` interface in `modules/research/src/adapters/sqlite-graph-store.ts` (and a sibling for the research/decision stores). node:sqlite proved the SQL/FTS5 is correct; pick the prod driver in implementation (see Open questions).

## Build pipeline (graphify → SQLite)

1. Client files land in `/data/sources` (git pull, upload endpoint, or rsync).
2. **graphify batch** runs on the box → graph JSON (`.graphify_*.json`).
3. `loadGraphifyOutput()` parses it → `SqliteGraphStore.upsert*` → `/data/graph.db` (+ FTS index).
4. Incremental re-runs on change (graphify supports incremental).

**Trigger:** start with **manual / cron** (stable SOP corpora don't need realtime). On-upload (queue → build) is a later enhancement. graphify never runs at query time.

## Query path (runtime, already built + e2e-verified)

`question → GraphRetriever (FTS entry-point → 1-hop → cited passages + source excerpt via ContentReader reading /data/sources) → gateway-synthesizer → ai-gateway.complete → provider → research() → cited brief (cite-or-refuse, owner-scoped, audited)`. Decisions ground on research briefs (Plan: decision↔research edge).

## AI / governance

- **ai-gateway** is the single AI egress: fail-closed authz (`ai.invoke`), per-tenant token **budget** (429 before spend), **audit** + token **metering** per call.
- **BYOK** provider keys = **Fly secrets** (`OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY`); never on disk/in prompts. Provider chosen via `AiConfig.provider`. Workers AI not available off-Cloudflare → on Fly use OpenRouter or Anthropic.
- Approval-gated `ai-provider-calls` per the module manifests.

## Isolation & governance

- **Machine = tenant boundary** → cross-client isolation is physical. `ownerId`/roles scope users within the one client org (multi-role permissions, approvals, audit, handoffs — the governance moat).
- Briefs/logs/audit all `ownerId`-scoped; cite-or-refuse links every claim to a real `/data/sources` file.

## Maps to shipped code

| Concern | Code |
|---|---|
| Graph store (FTS5, traversal) | `research/src/adapters/sqlite-graph-store.ts` |
| Loader (graphify JSON → store) | `research/src/graph.ts` `loadGraphifyOutput` |
| Retriever (+ source excerpts) | `research/src/graph.ts` `createGraphRetriever` + `ContentReader` |
| Synthesis bridge | `research/src/adapters/gateway-synthesizer.ts` |
| AI egress | `ai-gateway/src/index.ts` + `adapters/{openrouter,anthropic,workers-ai}.ts` |
| Briefs / decisions | `research/src/index.ts`, `decision/src/index.ts` |

## Open questions (resolve in implementation)

1. **Driver:** better-sqlite3 (sync, simplest, native build) vs libsql (async, matches the `SqlDatabase` async shape, easier remote/replica). Lean libsql for the async fit + optional Turso replica as the R2-alternative durable layer.
2. **Volume durability / backup cadence** — snapshot → R2 interval; restore drill.
3. **Build trigger** — manual/cron first; on-upload queue later.
4. **Process model** — single agent process vs separate build worker; Hermes byo-fly hosts the agent loop.
5. **Economics** — always-on vs scale-to-zero (cold-start cost) per client; premium-tier pricing must cover a dedicated machine.
