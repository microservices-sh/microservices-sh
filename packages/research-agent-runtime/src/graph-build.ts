// On-box graph build: run graphify over the client's files, then load the
// resulting JSON into the runtime's SQLite graph. Trigger manually or on a cron
// (e.g. `fly machine run ... node dist/graph-build.mjs`, or a scheduled task).
// graphify (pip: graphifyy) must be installed in the image — see Dockerfile.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteDatabase, runMigration } from "@microservices-sh/research/adapters/node-sqlite-graph";
import { createOpenRouterProvider } from "@microservices-sh/ai-gateway/adapters/openrouter";
import { bootResearchRuntime } from "./runtime.js";
import { loadGraphFromDir } from "./graph-load.js";

const run = promisify(execFile);

const DB_PATH = process.env.DB_PATH ?? "/data/graph.db";
const SOURCES_DIR = process.env.SOURCES_DIR ?? "/data/sources";
const OWNER_ID = process.env.OWNER_ID ?? "owner";
// graphify CLI invocation (no shell — arg array). Override via env if needed.
const GRAPHIFY_CMD = process.env.GRAPHIFY_CMD ?? "graphify";
const GRAPHIFY_ARGS = (process.env.GRAPHIFY_ARGS ?? "--no-viz").split(" ").filter(Boolean);
// Where graphify wrote the .graphify_*.json (varies by version; default = sources dir).
const GRAPH_OUT_DIR = process.env.GRAPH_OUT_DIR ?? SOURCES_DIR;

async function main() {
  console.log(`graphify build: ${GRAPHIFY_CMD} ${[...GRAPHIFY_ARGS, SOURCES_DIR].join(" ")}`);
  const { stdout } = await run(GRAPHIFY_CMD, [...GRAPHIFY_ARGS, SOURCES_DIR], { cwd: SOURCES_DIR, maxBuffer: 64 * 1024 * 1024 });
  if (stdout) console.log(stdout.slice(-500));

  const raw = new DatabaseSync(DB_PATH);
  for (const sql of [
    "node_modules/@microservices-sh/research/migrations/0001_research.sql",
    "node_modules/@microservices-sh/decision/migrations/0001_decision.sql"
  ]) {
    try {
      runMigration(raw, readFileSync(sql, "utf8"));
    } catch (err) {
      console.error(`migration ${sql}:`, (err as Error).message);
    }
  }

  // Provider is unused during load (no AI call), but bootResearchRuntime needs the config shape.
  const runtime = bootResearchRuntime({
    db: createNodeSqliteDatabase(raw),
    readContent: () => null,
    ai: {
      config: { provider: "openrouter", completeModel: "unused", embedModel: "" },
      providers: { openrouter: createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY ?? "unused" }) }
    }
  });

  const loaded = (await loadGraphFromDir({ runtime, dir: GRAPH_OUT_DIR, ownerId: OWNER_ID, readFile: (p) => readFileSync(p, "utf8") })) as any;
  console.log("graph loaded:", JSON.stringify(loaded.data));
}

main().catch((err) => {
  console.error("graph-build failed:", err);
  process.exit(1);
});
