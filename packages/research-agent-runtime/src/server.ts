// Fly entrypoint for one client's research/advise agent.
// Opens the volume SQLite DB, runs migrations, wires the runtime, and serves a
// tiny HTTP surface (health + research). Run with a TS-capable runtime (the
// Dockerfile bundles this with esbuild). Provider key comes from a Fly secret.
import { createServer } from "node:http";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteDatabase, runMigration } from "@microservices-sh/research/adapters/node-sqlite-graph";
import { createOpenRouterProvider } from "@microservices-sh/ai-gateway/adapters/openrouter";
import { bootResearchRuntime } from "./runtime.js";

const DB_PATH = process.env.DB_PATH ?? "/data/graph.db";
const SOURCES_DIR = process.env.SOURCES_DIR ?? "/data/sources";
const MODEL = process.env.AI_MODEL ?? "anthropic/claude-3.5-haiku";
const PORT = Number(process.env.PORT ?? 8080);
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error("OPENROUTER_API_KEY is required (set it as a Fly secret).");

// Migrations from the installed module packages.
const require_ = (p: string) => readFileSync(p, "utf8");
const raw = new DatabaseSync(DB_PATH);
for (const sql of [
  "node_modules/@microservices-sh/research/migrations/0001_research.sql",
  "node_modules/@microservices-sh/decision/migrations/0001_decision.sql"
]) {
  try {
    runMigration(raw, require_(sql));
  } catch (err) {
    console.error(`migration ${sql} failed (continuing):`, (err as Error).message);
  }
}

const readContent = ({ sourceFile, sourceLocation }: { sourceFile: string; sourceLocation: string }) => {
  try {
    // Confine to SOURCES_DIR: reject traversal/absolute/NUL, then resolve and
    // verify the real path stays inside the base (defense-in-depth — sourceFile
    // comes from graph data, which could be poisoned at ingestion).
    if (!sourceFile || sourceFile.includes("\0") || sourceFile.includes("..")) return null;
    const base = realpathSync(SOURCES_DIR);
    const real = realpathSync(resolve(base, sourceFile));
    if (real !== base && !real.startsWith(base + sep)) return null;
    const full = readFileSync(real, "utf8").split("\n");
    const m = /(\d+)/.exec(sourceLocation || "");
    if (!m) return full.slice(0, 25).join("\n").slice(0, 1200);
    const line = parseInt(m[1], 10) - 1;
    return full.slice(Math.max(0, line - 6), line + 16).join("\n").slice(0, 1200);
  } catch {
    return null;
  }
};

const runtime = bootResearchRuntime({
  db: createNodeSqliteDatabase(raw),
  readContent,
  ai: { config: { provider: "openrouter", completeModel: MODEL, embedModel: "" }, providers: { openrouter: createOpenRouterProvider({ apiKey: KEY }) } }
});

createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, model: MODEL }));
  }
  if (req.method === "POST" && req.url === "/research") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    const actor = { id: body.actorId ?? "owner", scopes: ["research.read", "ai.invoke"] };
    const result = await runtime.research({ question: body.question }, actor);
    res.writeHead(result.ok ? 200 : 422, { "content-type": "application/json" });
    return res.end(JSON.stringify(result));
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, () => console.log(`research-agent-runtime listening on :${PORT} (db=${DB_PATH}, model=${MODEL})`));
