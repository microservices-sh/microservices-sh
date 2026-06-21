// Fly entrypoint for one client's research/advise agent.
// Opens the volume SQLite DB, runs migrations, wires the runtime, and serves a
// tiny HTTP surface (health + research). Run with a TS-capable runtime (the
// Dockerfile bundles this with esbuild). Provider key comes from a Fly secret.
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteDatabase, runMigration } from "@microservices-sh/research/adapters/node-sqlite-graph";
import { createOpenRouterProvider } from "@microservices-sh/ai-gateway/adapters/openrouter";
import { createOperateHttpClient } from "@microservices-sh/research/adapters/operate-http";
import { loadWorkspaceConfig } from "@microservices-sh/research";
import { bootResearchRuntime } from "./runtime.js";
import { resolveUploadPath } from "./file-write.js";
import { createBuildTrigger } from "./graph-build-trigger.js";
// Migrations bundled as text (esbuild --loader:.sql=text) so they survive into
// the image — no runtime file reads / node_modules symlink dependency.
import researchMigration from "../../../modules/research/migrations/0001_research.sql";
import decisionMigration from "../../../modules/decision/migrations/0001_decision.sql";

const DB_PATH = process.env.DB_PATH ?? "/data/graph.db";
const SOURCES_DIR = process.env.SOURCES_DIR ?? "/data/sources";
const MODEL = process.env.AI_MODEL ?? "anthropic/claude-3.5-haiku";
const PORT = Number(process.env.PORT ?? 8080);
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error("OPENROUTER_API_KEY is required (set it as a Fly secret).");
// Caller auth: a shared bearer token (Fly secret). The actor identity is derived
// from server-side config, never from the request body — one box = one client.
const RUNTIME_TOKEN = process.env.RUNTIME_TOKEN;
if (!RUNTIME_TOKEN) throw new Error("RUNTIME_TOKEN is required (set it as a Fly secret).");
const OWNER_ID = process.env.OWNER_ID ?? "owner";

function authorized(header: string | undefined): boolean {
  const expected = `Bearer ${RUNTIME_TOKEN}`;
  const got = Buffer.from(header ?? "");
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

function csv(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

let raw = new DatabaseSync(DB_PATH);
runMigration(raw, researchMigration);
runMigration(raw, decisionMigration);

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

// Operations read-back (Plan 32): when this client's operate app URL + the minted
// OPS_TOKEN are set as Fly secrets, the agent can blend live operational records
// with the local graph via /assist. Absent ⇒ /assist stays graph-only.
const OPERATE_APP_URL = process.env.OPERATE_APP_URL;
const OPS_TOKEN = process.env.OPS_TOKEN;
const opsClient =
  OPERATE_APP_URL && OPS_TOKEN
    ? createOperateHttpClient({ baseUrl: OPERATE_APP_URL, serviceToken: OPS_TOKEN, fetch: (url, init) => fetch(url, init) })
    : undefined;

const ai = { config: { provider: "openrouter", completeModel: MODEL, embedModel: "" }, providers: { openrouter: createOpenRouterProvider({ apiKey: KEY }) } };

// Workspace config (/data/workspace): identity/policy preamble + cosmetic settings.
// Re-read on every (re)boot so editing the files + a graph rebuild applies them.
const WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? "/data/workspace";
const loadWorkspace = () => loadWorkspaceConfig(WORKSPACE_DIR, { read: async (path) => readFileSync(path, "utf8") });

let workspace = await loadWorkspace();
let runtime = bootResearchRuntime({ db: createNodeSqliteDatabase(raw), readContent, ai, opsClient, workspace });

// After an on-box rebuild the DB file is replaced, leaving the original handle
// stale (reads the old graph; writes hit "attempt to write a readonly database").
// Re-open the DB, re-read the workspace, and rebuild the runtime so the next
// request sees the fresh graph + config with a writable handle — no restart.
async function reopenRuntime() {
  try { raw.close(); } catch { /* already closed/unlinked */ }
  raw = new DatabaseSync(DB_PATH);
  runMigration(raw, researchMigration);
  runMigration(raw, decisionMigration);
  workspace = await loadWorkspace();
  runtime = bootResearchRuntime({ db: createNodeSqliteDatabase(raw), readContent, ai, opsClient, workspace });
}

// Ops read scopes the box-owner actor carries when blending (read-only). Keep
// the default aligned with the booking template's mounted /ops tools; richer
// operate apps can set OPS_READ_SCOPES to opt into more tools.
const OPS_READ_SCOPES = csv(process.env.OPS_READ_SCOPES, ["ops.customer.read", "ops.booking.read"]);

// On-box graph (re)build: spawn the bundled job as a child process so graphify
// runs out-of-band, then it reloads the graph into this same SQLite file. The
// child inherits our env (OWNER_ID, keys, DB/SOURCES paths). One build at a time.
const GRAPH_BUILD_SCRIPT = process.env.GRAPH_BUILD_SCRIPT
  ?? join(dirname(fileURLToPath(import.meta.url)), "graph-build.mjs");
const buildTrigger = createBuildTrigger(
  (onDone) => {
    execFile(process.execPath, [GRAPH_BUILD_SCRIPT], { env: process.env, maxBuffer: 64 * 1024 * 1024 }, async (err, stdout, stderr) => {
      // On success the DB was rebuilt by the child — re-open so the server picks
      // up the fresh graph + workspace config (and a writable handle), no restart.
      if (!err) {
        try { await reopenRuntime(); } catch (e) { console.error("reopen after build failed:", e instanceof Error ? e.message : e); }
      }
      onDone(!err, `${stdout ?? ""}${stderr ?? ""}`.slice(-2000));
    });
  },
  () => new Date().toISOString()
);

createServer(async (req, res) => {
 try {
  if (req.url === "/health") {
    // Unauthenticated (Fly health checks) — must not leak config.
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.url === "/graph-build") {
    if (!authorized(req.headers.authorization)) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }));
    }
    if (req.method === "POST") {
      const started = buildTrigger.start();
      res.writeHead(started ? 202 : 409, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: started, status: buildTrigger.status() }));
    }
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, status: buildTrigger.status() }));
    }
  }
  if (req.method === "POST" && req.url === "/research") {
    if (!authorized(req.headers.authorization)) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }));
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    // Actor identity comes from server-side config, NOT the request body.
    const actor = { id: OWNER_ID, tenantId: OWNER_ID, scopes: ["research.read", "ai.invoke"] };
    const result = await runtime.research({ question: String(body.question ?? "") }, actor);
    res.writeHead(result.ok ? 200 : 422, { "content-type": "application/json" });
    return res.end(JSON.stringify(result));
  }
  if (req.method === "POST" && req.url === "/assist") {
    if (!authorized(req.headers.authorization)) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }));
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    const actor = { id: OWNER_ID, tenantId: OWNER_ID, scopes: ["research.read", "ai.invoke", ...OPS_READ_SCOPES] };
    const result = await runtime.assist({ question: String(body.question ?? "") }, actor);
    res.writeHead(result.ok ? 200 : 422, { "content-type": "application/json" });
    return res.end(JSON.stringify(result));
  }
  // Workspace/corpus file management over HTTP (no SSH). Confined to /data/sources
  // and /data/workspace by resolveUploadPath. POST writes; GET lists an area.
  if (req.url?.startsWith("/files/")) {
    if (!authorized(req.headers.authorization)) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }));
    }
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname.slice("/files/".length));
    const slash = rel.indexOf("/");
    const area = slash === -1 ? rel : rel.slice(0, slash);
    const name = slash === -1 ? "" : rel.slice(slash + 1);
    const dirs = { sourcesDir: SOURCES_DIR, workspaceDir: WORKSPACE_DIR };

    if (req.method === "GET") {
      const base = ({ sources: SOURCES_DIR, workspace: WORKSPACE_DIR } as Record<string, string>)[area];
      if (!base) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: { code: "BAD_AREA" } }));
      }
      let files: string[] = [];
      try { files = readdirSync(base); } catch { files = []; }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, area, files }));
    }
    if (req.method === "POST" || req.method === "PUT") {
      const resolved = resolveUploadPath({ area, name, ...dirs });
      if (!resolved.ok) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: { code: resolved.code } }));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const c of req) {
        size += (c as Buffer).length;
        if (size > 10 * 1024 * 1024) {
          res.writeHead(413, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: { code: "FILE_TOO_LARGE" } }));
        }
        chunks.push(c as Buffer);
      }
      const data = Buffer.concat(chunks);
      mkdirSync(dirname(resolved.path), { recursive: true });
      writeFileSync(resolved.path, data);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, path: `${area}/${name}`, bytes: data.length }));
    }
  }
  res.writeHead(404);
  res.end();
 } catch (err) {
  // A provider/AI error (or any handler failure) must not crash the process.
  console.error("request failed:", err instanceof Error ? err.message : err);
  if (!res.headersSent) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: { code: "RUNTIME_ERROR", message: "Request failed." } }));
  } else {
    res.end();
  }
 }
}).listen(PORT, () => console.log(`research-agent-runtime listening on :${PORT} (db=${DB_PATH}, model=${MODEL})`));
