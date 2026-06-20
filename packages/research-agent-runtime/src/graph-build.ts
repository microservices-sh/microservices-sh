// On-box graph build: run graphify over the client's files, then load the
// resulting graph.json into the runtime's SQLite graph. Trigger manually or on a
// cron. graphify (pip: graphifyy, a version with the `extract` subcommand) must be
// installed in the image with an OpenRouter provider configured — see Dockerfile.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteDatabase, runMigration } from "@microservices-sh/research/adapters/node-sqlite-graph";
import { createSqliteGraphStore } from "@microservices-sh/research/adapters/sqlite-graph";
import { loadGraphifyDir } from "@microservices-sh/research";
import researchMigration from "../../../modules/research/migrations/0001_research.sql";
import decisionMigration from "../../../modules/decision/migrations/0001_decision.sql";

const run = promisify(execFile);

const DB_PATH = process.env.DB_PATH ?? "/data/graph.db";
const SOURCES_DIR = process.env.SOURCES_DIR ?? "/data/sources";
const OWNER_ID = process.env.OWNER_ID ?? "owner";
// graphify CLI: `graphify extract <dir>` (subcommand form). It writes graph.json
// (+ .graphify_analysis.json) under GRAPHIFY_OUT; the loader reads graph.json —
// the documented, version-stable export, not internal artifacts.
const GRAPHIFY_CMD = process.env.GRAPHIFY_CMD ?? "graphify";
const GRAPHIFY_SUBCOMMAND = process.env.GRAPHIFY_SUBCOMMAND ?? "extract";
const GRAPHIFY_OUT = process.env.GRAPHIFY_OUT ?? `${SOURCES_DIR}/graphify-out`;

async function main() {
  console.log(`graphify build: ${GRAPHIFY_CMD} ${GRAPHIFY_SUBCOMMAND} ${SOURCES_DIR} (out=${GRAPHIFY_OUT})`);
  const { stdout } = await run(GRAPHIFY_CMD, [GRAPHIFY_SUBCOMMAND, SOURCES_DIR], {
    cwd: SOURCES_DIR,
    env: { ...process.env, GRAPHIFY_OUT },
    maxBuffer: 64 * 1024 * 1024
  });
  if (stdout) console.log(stdout.slice(-500));

  const raw = new DatabaseSync(DB_PATH);
  runMigration(raw, researchMigration);
  runMigration(raw, decisionMigration);
  const store = createSqliteGraphStore(createNodeSqliteDatabase(raw));

  // Drift-robust ingest: reads GRAPHIFY_OUT/graph.json (Plan 31 adapter).
  const result = await loadGraphifyDir(GRAPHIFY_OUT, { store, ownerId: OWNER_ID }, async (p) => readFileSync(p, "utf8"));
  console.log("graph loaded:", JSON.stringify(result.ok ? result.data : result.error));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error("graph-build failed:", err);
  process.exit(1);
});
