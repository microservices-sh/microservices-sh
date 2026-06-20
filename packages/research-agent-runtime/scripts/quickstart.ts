// Local end-to-end quickstart: run the whole research flow against a real folder
// without Fly. Builds (or reuses) the graphify graph, loads it into an in-memory
// SQLite, boots the runtime, and prints a live cited brief.
//
//   OPENROUTER_API_KEY=sk-or-... \
//   node --experimental-strip-types packages/research-agent-runtime/scripts/quickstart.ts \
//     <client-folder> "<question>"
//
// Reuses ~/.config/openrouter/key if the env var is unset. Model via OPENROUTER_MODEL.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteDatabase, runMigration } from "@microservices-sh/research/adapters/node-sqlite-graph";
import { createOpenRouterProvider } from "@microservices-sh/ai-gateway/adapters/openrouter";
import { bootResearchRuntime } from "../src/runtime.ts";
import { loadGraphFromDir } from "../src/graph-load.ts";

const dir = process.argv[2] ?? ".";
const question = process.argv[3] ?? "What is this project about?";
const model = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const keyFile = `${homedir()}/.config/openrouter/key`;
const key = process.env.OPENROUTER_API_KEY ?? (existsSync(keyFile) ? readFileSync(keyFile, "utf8").trim() : "");
if (!key) {
  console.error("Set OPENROUTER_API_KEY (or ~/.config/openrouter/key).");
  process.exit(1);
}
// Run from the monorepo root — read the migration from the module source.
const migration = () => readFileSync("modules/research/migrations/0001_research.sql", "utf8");
const actor = { id: "demo", tenantId: "demo", scopes: ["research.read", "ai.invoke"] };

// 1. Build the knowledge graph (skip if graphify output already exists).
if (!existsSync(`${dir}/.graphify_semantic.json`)) {
  console.log(`[1/3] graphify ${dir} --no-viz ...`);
  execFileSync("graphify", [dir, "--no-viz"], { cwd: dir, stdio: "inherit" });
} else {
  console.log("[1/3] reusing existing graphify output");
}

// 2. Load it into an in-memory SQLite graph + boot the runtime.
console.log("[2/3] loading graph into sqlite + booting runtime ...");
const raw = new DatabaseSync(":memory:");
runMigration(raw, migration());
const runtime = bootResearchRuntime({
  db: createNodeSqliteDatabase(raw),
  readContent: ({ sourceFile, sourceLocation }) => {
    try {
      const full = readFileSync(`${dir}/${sourceFile}`, "utf8").split("\n");
      const m = /(\d+)/.exec(sourceLocation || "");
      if (!m) return full.slice(0, 25).join("\n").slice(0, 1200);
      const line = parseInt(m[1], 10) - 1;
      return full.slice(Math.max(0, line - 6), line + 16).join("\n").slice(0, 1200);
    } catch {
      return null;
    }
  },
  ai: { config: { provider: "openrouter", completeModel: model, embedModel: "" }, providers: { openrouter: createOpenRouterProvider({ apiKey: key }) } }
});
const loaded = (await loadGraphFromDir({ runtime, dir, ownerId: actor.id, readFile: (p) => readFileSync(p, "utf8") })) as any;
console.log("      graph:", JSON.stringify(loaded.data));

// 3. Ask a question → live cited brief.
console.log(`[3/3] research: "${question}" (${model}) ...`);
const result = (await runtime.research({ question }, actor)) as any;
if (!result.ok) {
  console.log("\nREFUSED:", JSON.stringify(result.error));
  process.exit(0);
}
console.log("\n=== BRIEF ===");
console.log(result.data.brief.answer);
console.log("\nCITES:", result.data.brief.citations.map((c: any) => c.sourceFile).join(", "));
