# Per-client research/advise agent runtime. One machine per client.
FROM node:22-slim AS build
WORKDIR /app
ENV CI=true
COPY . .
# Bundle the service + the graph-build job (each a single ESM file; node builtins external).
RUN corepack enable && pnpm install --frozen-lockfile=false \
 && pnpm --filter @microservices-sh/research-agent-runtime build \
 && pnpm --filter @microservices-sh/research-agent-runtime build:graph

FROM node:22-slim
WORKDIR /app
# graphify (pip: graphifyy) for the on-box graph build job.
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
 && pip3 install "graphifyy==0.3.21" --break-system-packages -q \
 && rm -rf /var/lib/apt/lists/*
# Self-contained bundles (workspace deps + migrations inlined by esbuild).
COPY --from=build /app/packages/research-agent-runtime/dist/server.mjs ./server.mjs
COPY --from=build /app/packages/research-agent-runtime/dist/graph-build.mjs ./graph-build.mjs
ENV DB_PATH=/data/graph.db SOURCES_DIR=/data/sources PORT=8080
VOLUME ["/data"]
EXPOSE 8080
# Service. Build the graph on a cron/manual run: `node graph-build.mjs`.
CMD ["node", "server.mjs"]
