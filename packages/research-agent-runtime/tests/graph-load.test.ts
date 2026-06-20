import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeSqliteDatabase, runMigration } from "@microservices-sh/research/adapters/node-sqlite-graph";
import { bootResearchRuntime } from "../src/runtime";
import { loadGraphFromDir } from "../src/graph-load";

let DatabaseSync: any;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = undefined;
}

const actor = { id: "acme", scopes: ["research.read", "ai.invoke"] };
const provider = {
  async complete() {
    return { text: '{"answer":"Margins fell.","citations":["docs/margins.md"]}', usage: { inputTokens: 1, outputTokens: 1 } };
  },
  async embed() { throw new Error("no embed"); }
};

const fixture = {
  semantic: {
    nodes: [{ id: "m", label: "Margin report", file_type: "document", source_file: "docs/margins.md", source_location: "L1" }],
    edges: []
  },
  analysis: { communities: { "0": ["m"] } },
  labels: { "0": "Finance" }
};

describe.skipIf(!DatabaseSync)("graph-load: graphify files -> runtime.loadGraph", () => {
  it("reads .graphify_*.json from a dir, loads the graph, and it's queryable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "graphload-"));
    writeFileSync(join(dir, ".graphify_semantic.json"), JSON.stringify(fixture.semantic));
    writeFileSync(join(dir, ".graphify_analysis.json"), JSON.stringify(fixture.analysis));
    writeFileSync(join(dir, ".graphify_labels.json"), JSON.stringify(fixture.labels));

    const raw = new DatabaseSync(":memory:");
    runMigration(raw, readFileSync("modules/research/migrations/0001_research.sql", "utf8"));
    const runtime = bootResearchRuntime({
      db: createNodeSqliteDatabase(raw),
      readContent: ({ sourceFile }) => `EXCERPT of ${sourceFile}`,
      ai: { config: { provider: "openrouter", completeModel: "fake", embedModel: "" }, providers: { openrouter: provider } },
      now: () => 0
    });

    const loaded = (await loadGraphFromDir({ runtime, dir, ownerId: "acme", readFile: (p) => readFileSync(p, "utf8") })) as any;
    expect(loaded.data).toEqual({ nodes: 1, edges: 0, communities: 1 });

    // graph is now queryable through the runtime
    const r = await runtime.research({ question: "What does the margin report say?" }, actor);
    expect(r.ok).toBe(true);
    expect((r as any).data.brief.citations[0].sourceFile).toBe("docs/margins.md");
  });
});
