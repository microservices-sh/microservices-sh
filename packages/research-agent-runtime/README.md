# research-agent-runtime (per-client Fly)

Boots the GraphRAG research/advise agent for **one client** on its own Fly machine
(see `plans/28-fly-runtime-graphrag-agent.md`). Machine = tenant boundary.

- `src/runtime.ts` — `bootResearchRuntime({ db, readContent, ai })` wires research +
  decision + ai-gateway over one SQLite DB. Pure composition (DB injected).
- `src/server.ts` — Fly entrypoint: opens node:sqlite over `/data/graph.db`, runs
  the module migrations, builds a volume-backed `ContentReader`, picks the
  OpenRouter provider (BYOK via `OPENROUTER_API_KEY` secret), serves `/health` + `POST /research`.
- `src/graph-build.ts` — on-box build job: runs `graphify` over `/data/sources`,
  then loads the resulting `.graphify_*.json` into the SQLite graph via
  `loadGraphFromDir` → `runtime.loadGraph`. Run on a cron or manually.
- `src/graph-load.ts` — pure bridge (graphify JSON → `runtime.loadGraph`), tested.

## Build / refresh the graph (per client)
Drop the client's files in `/data/sources`, then:
```
fly ssh console -a acme-research-agent -C "node /app/graph-build.mjs"
# or schedule it: fly machine run ... node graph-build.mjs   (nightly/weekly)
```
graphify runs on the box (it's in the image); the query path never runs graphify.

## Deploy (per client)
```
fly apps create acme-research-agent
fly volumes create research_data --size 1 -a acme-research-agent
fly secrets set OPENROUTER_API_KEY=sk-or-... RUNTIME_TOKEN=$(openssl rand -hex 32) -a acme-research-agent
fly deploy -a acme-research-agent --dockerfile Dockerfile
```

`POST /research` requires `Authorization: Bearer $RUNTIME_TOKEN`; the actor
identity is fixed server-side (`OWNER_ID`), never taken from the request body.
`/health` is unauthenticated and leaks no config.

Storage driver defaults to node:sqlite (zero-dep). Swap to libsql/Turso via
`@microservices-sh/research/adapters/libsql-graph` for a replicated DB.
