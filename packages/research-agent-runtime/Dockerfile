# Per-client research/advise agent runtime. One machine per client.
FROM node:22-slim AS build
WORKDIR /app
COPY . .
# Bundle server + workspace TS deps into a single ESM file (node builtins external).
RUN corepack enable && pnpm install --frozen-lockfile=false \
 && pnpm --filter @microservices-sh/research-agent-runtime build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/packages/research-agent-runtime/dist/server.mjs ./server.mjs
# Migrations + source files are read at runtime from the mounted volume / image.
ENV DB_PATH=/data/graph.db SOURCES_DIR=/data/sources PORT=8080
VOLUME ["/data"]
EXPOSE 8080
# node:sqlite is built in; --experimental-sqlite silences the flag on older 22.x.
CMD ["node", "server.mjs"]
