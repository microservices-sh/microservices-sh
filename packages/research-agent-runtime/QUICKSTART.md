# Research / Advise agent — quickstart

A per-client runtime that reads the client's files, builds a knowledge graph
(graphify), and answers questions with **cited, grounded** briefs — refusing
when it can't ground an answer. One Fly machine = one client (the tenant
boundary). The volume at `/data` is the source of truth; AI egress is governed
and BYOK.

Two ways to run it:

- **Local quickstart** — prove the loop on your laptop, no Fly. (`scripts/quickstart.sh`)
- **Fly deploy** — one machine per client. (`scripts/deploy.sh`)

## What's inside

```
files (/data/sources)
  └─ graphify ──> .graphify_{semantic,analysis,labels}.json
        └─ graph-build ──> SQLite graph (/data/graph.db, FTS5)
              └─ research(): retrieve (1-hop) ─> synthesize ─> cite-or-refuse
                    └─ decision(): draft brief from research, log decision
```

Everything is files + SQLite on the box. The graph is built in a batch job
(`graph-build.mjs`); the service (`server.mjs`) only reads it.

## Local quickstart

Needs: Node 22+ (for `node:sqlite`), Python 3 with `graphify` on PATH
(`pip install graphifyy`), and an OpenRouter key (any OpenAI-compatible key works
via the gateway's openrouter provider).

```bash
cd packages/research-agent-runtime
OPENROUTER_API_KEY=sk-or-... ./scripts/quickstart.sh <folder> "<question>"
```

It bundles the runner (esbuild), runs graphify over `<folder>` if no graph
exists yet (else reuses it), loads the graph into an in-memory SQLite, boots the
runtime, and prints a brief citing real files. If nothing in the folder grounds
the question, it refuses — that's the contract, not a bug.

## Fly deploy (one machine per client)

Needs: `flyctl` authed, `openssl`, an OpenRouter key.

```bash
cd packages/research-agent-runtime
OPENROUTER_API_KEY=sk-or-... ./scripts/deploy.sh <client-slug> [region]
```

This creates the app + a 1GB volume (`research_data` → `/data`), sets secrets
(`OPENROUTER_API_KEY`, a random `RUNTIME_TOKEN`, `OWNER_ID=<client-slug>`), and
deploys the image (build context = monorepo root; migrations are inlined into the
bundle so no `node_modules` ships).

Then:

```bash
# 1. put the client's files on the volume at /data/sources
# 2. build the graph on the box
fly ssh console -a <client-slug>-research-agent -C "node /app/graph-build.mjs"
# 3. query
curl -s https://<client-slug>-research-agent.fly.dev/research \
  -H "Authorization: Bearer $RUNTIME_TOKEN" \
  -H "content-type: application/json" \
  -d '{"question":"How does X work?"}'
```

## Security model

- **Auth**: `/research` requires `Authorization: Bearer $RUNTIME_TOKEN`
  (constant-time compare). `/health` is open but leaks nothing (`{ok:true}`).
- **Actor is server-side**: identity = `OWNER_ID` (Fly secret), never the request
  body. One box, one client — no cross-tenant access surface.
- **Path confinement**: source excerpts are read only from inside `SOURCES_DIR`
  (realpath-checked; rejects `..`, absolute, NUL).
- **Cite-or-refuse**: every claim cites a retrieved source file; citations must
  be a subset of what retrieval returned, or the answer is refused.
- **Governed AI**: all model calls go through the ai-gateway (authz + per-tenant
  token budget/metering). Keys are BYOK via Fly secrets — rotate freely.

## Config (env / Fly secrets)

| var | default | meaning |
|-----|---------|---------|
| `OPENROUTER_API_KEY` | — (required) | model provider key (BYOK) |
| `RUNTIME_TOKEN` | — (required) | bearer token for `/research` |
| `OWNER_ID` | `owner` | tenant/actor id (= client slug) |
| `DB_PATH` | `/data/graph.db` | SQLite graph file |
| `SOURCES_DIR` | `/data/sources` | client files (graphify input + excerpts) |
| `AI_MODEL` | `anthropic/claude-3.5-haiku` | synthesis model (OpenRouter id) |
| `PORT` | `8080` | HTTP port |
| `GRAPHIFY_ARGS` | `--no-viz` | graphify CLI args (graph-build only) |
