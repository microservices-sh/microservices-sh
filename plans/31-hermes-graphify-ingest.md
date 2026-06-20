# Plan 31 — Hermes Knowledge-Data Ingestion (graphify-out → graph store)

*Status: implemented (2026-06-20). Fills the one missing seam in [Plan 28](28-fly-runtime-graphrag-agent.md): wiring real graphify output into the per-client GraphRAG store on the Hermes Fly runtime.*

## Implementation status (2026-06-20)

- ✅ **Ingest adapter** — `modules/research/src/adapters/graphify-out-loader.ts` `loadGraphifyDir(dir, {store, ownerId}, read?)`. Reads `graph.json` only; `.graphify_analysis.json` cohesion is best-effort. 7 tests against a committed real graphify output (`__fixtures__/graphify-out/`, 17 nodes/26 edges/2 communities) incl. retrieval round-trip + error paths.
- ✅ **Build orchestrator** — `modules/research/src/build-graph.ts` `runGraphBuild({mode: "manual"|"cron", ...})`. `manual` → full `extract`; `cron` → incremental `extract --update`. graphify failure ⇒ `GRAPHIFY_BUILD_FAILED`, no ingest. 3 tests.
- ✅ **On-box runner** — `deploy/hermes-agent/jobs/build-graph.mjs` wires graphify spawn + node:sqlite `graph.db` + the orchestrator; env-driven (`BUILD_MODE`, `OWNER_ID`, `SOURCES_DIR`, …). Includes the cron crontab line. *Not yet run on a live machine.*
- Gates: 36 research tests green · tsgo clean · module contract check passed.
- **Paths corrected:** the real Fly volume mounts at **`/opt/data`** (not `/data` as Plan 28 drafted) — runner defaults updated accordingly.

Remaining (Open questions below): edge audit-provenance column, prod driver choice, incremental full-replace semantics, wiring the runner into the image + a real cron/manual trigger on `microservices-sh-hermes`.

## Problem

Plan 28's build pipeline step 3 — `loadGraphifyOutput() parses graphify output → SqliteGraphStore` — is **not wired**. Today:

- `loadGraphifyOutput()` (`modules/research/src/graph.ts:122`) exists and is unit-tested, but is **called only from tests** with hand-built fixtures.
- **No adapter** reads graphify's real on-disk output and maps it to the `GraphifyOutput` shape the function expects.
- **No build-job runner** turns `/data/sources` → graph on the box.

Everything up/downstream is shipped: graphify (the tool) builds graphs; the SQLite store, FTS5 retriever, ai-gateway, research/decision use-cases all work. This plan specifies only the bridge.

## Decision

**Ingest from `graphify-out/graph.json` alone.** graph.json is graphify's stable, documented `node_link_data` export and already embeds everything the store needs. The internal `.graphify_analysis.json` / `.graphify_labels.json` artifacts are **optional enrichment only** — never required — because they drift across graphify versions (that drift is what broke the loader at the start of this work). Reading the documented export is the version-robustness guarantee.

## Shape mapping (real → target)

`graph.json` node (real) → `GraphifyOutput.semantic.nodes[]` (target):

| graph.json node field | GraphifyNode field | notes |
|---|---|---|
| `id` | `id` | |
| `label` | `label` | |
| `file_type` | `file_type?` | |
| `source_file` | `source_file` | required by store (cite-or-refuse pointer) |
| `source_location` (nullable) | `source_location` | `null` → `""` downstream (already handled) |
| `community` (int) | → `analysis.communities` | group node ids by this int |
| `community_name` | → `labels[community]` | per-node, dedup to one label per cid |

`graph.json` `links[]` (key is **`links`**, networkx default) → `GraphifyOutput.semantic.edges[]`:

| links field | GraphifyEdge field | notes |
|---|---|---|
| `source` | `source` | |
| `target` | `target` | |
| `relation` | `relation` | |
| `weight` | `weight?` | |
| `confidence` / `confidence_score` | *(dropped today)* | see Open Q1 — audit provenance |

Derived:
- `analysis.communities`: `{ [String(community)]: nodeId[] }` grouped from `node.community`.
- `labels`: `{ [String(cid)]: community_name }` from the nodes' `community_name`.
- `analysis.cohesion` (optional): if `.graphify_analysis.json` is present and parses, fold in its `cohesion` map; else omit (it is optional in `GraphCommunity`).

`hyperedges` in graph.json: ignored in v1.

## Adapter contract

```
// modules/research/src/adapters/graphify-out-loader.ts  (NEW)
loadGraphifyDir(dir: string, deps: { store: GraphStore; ownerId: string },
                read?: (p: string) => Promise<string>): Promise<Result<{nodes,edges,communities}>>
```

- Reads `<dir>/graph.json` (required). Missing/invalid → typed error, no throw.
- Best-effort reads `<dir>/.graphify_analysis.json` for `cohesion` (optional; failure is silent).
- Maps to `GraphifyOutput`, delegates to existing `loadGraphifyOutput()` (no store logic duplicated).
- `read` injectable for tests (no real FS needed); defaults to `node:fs/promises`.

## Version-drift guard

- Depend only on `graph.json` keys: `nodes[].{id,label,file_type,source_file,source_location,community,community_name}` and `links[].{source,target,relation,weight}`.
- Tolerate extra/missing optional fields; never read `.graphify_semantic_marker` or other `.graphify_*` internals as required input.
- A `graph.json` that parses but lacks `nodes` or `links` → typed error naming the missing key.
- One golden fixture committed from a real graphify run (the `/tmp/gtest` corpus) so a schema change in graphify breaks a test, not production.

## Build-job runner (on the Fly box)

```
deploy/hermes-agent/jobs/build-graph   (NEW, manual | cron)
  1. graphify extract /data/sources         (GRAPHIFY_OUT=/data/graphify-out; --update if prior run)
  2. loadGraphifyDir('/data/graphify-out', { store: SqliteGraphStore('/data/graph.db'), ownerId })
  3. (later) snapshot /data → R2
```

- BYOK: `OPENROUTER_API_KEY` as a Fly secret (same key/provider this work standardized; default model `deepseek/deepseek-v4-flash` via `~/.graphify/providers.json`). graphify never runs at query time.
- Trigger: manual/cron first; on-upload queue is a later enhancement (Plan 28 Open Q3).
- `ownerId` = the single client-org owner for that machine (machine = tenant boundary).

## Test strategy (TDD)

1. **Adapter unit** (`graphify-out-loader.test.ts`): inject `read` returning the committed golden `graph.json`; assert counts (17 nodes / 26 edges / 2 communities), community grouping from `node.community`, labels from `community_name`, null `source_location` → `""`, and the missing-`links` error path.
2. **Round-trip**: `loadGraphifyDir` → `createMemoryGraphStore` → `searchNodes("auth")` returns the auth node with `communityId` + `ownerId` set (reuses existing retriever tests).
3. **SQLite**: gated like the existing `sqlite-graph-store.test.ts` (no SQLite in CI sandbox — keep behind the same guard).
4. Build-job runner: smoke-tested locally against `/tmp/gtest`; not in CI (needs graphify + key).

## Open questions

1. **Audit provenance** — preserve `links[].confidence` (EXTRACTED/INFERRED/AMBIGUOUS) onto `GraphEdge`? It directly serves cite-or-refuse / brief trust scoring. Lean yes, as an additive optional field; requires a `research` migration column. Decide before implementing the store write.
2. **Driver** — inherits Plan 28 Open Q1 (better-sqlite3 vs libsql). Adapter is driver-agnostic (writes via `GraphStore`); no blocker.
3. **Incremental** — graphify `--update` prunes deleted-file nodes in its own output; confirm the store upsert path also removes stale nodes/edges on re-ingest (full-replace per owner vs diff). v1 = full replace per `ownerId`.
4. **Multi-corpus** — one graph per machine assumed; if a client needs multiple source roots, namespace by a corpus id (defer).

## Maps to code

| Concern | Code |
|---|---|
| Ingest fn (exists) | `modules/research/src/graph.ts` `loadGraphifyOutput` |
| **Adapter (new)** | `modules/research/src/adapters/graphify-out-loader.ts` |
| Store | `modules/research/src/adapters/sqlite-graph-store.ts` |
| Build job (new) | `deploy/hermes-agent/jobs/build-graph` |
| Runtime app | Fly `microservices-sh-hermes` (`deploy/hermes-agent`) |
