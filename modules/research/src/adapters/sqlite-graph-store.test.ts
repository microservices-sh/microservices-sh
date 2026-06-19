import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createGraphRetriever, loadGraphifyOutput } from "../graph";
import { createSqliteGraphStore } from "./sqlite-graph-store";
import { createNodeSqliteDatabase, runMigration } from "./node-sqlite-graph";

// Real SQLite (FTS5 + traversal) via Node 22's builtin node:sqlite — the Fly
// driver path. Gated on availability so older-Node CI skips cleanly.
let DatabaseSync: any;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = undefined;
}

const MIGRATION = "modules/research/migrations/0001_research.sql";

const graphifyOutput = {
  semantic: {
    nodes: [
      { id: "margins_doc", label: "Margin report", file_type: "document", source_file: "docs/margins.md", source_location: "L1" },
      { id: "pricing", label: "Pricing policy", file_type: "document", source_file: "docs/pricing.md", source_location: "L10" },
      { id: "snacks", label: "Office snacks", file_type: "document", source_file: "docs/office.md", source_location: "L3" }
    ],
    edges: [{ source: "margins_doc", target: "pricing", relation: "references", weight: 1.0 }]
  },
  analysis: { communities: { "0": ["margins_doc", "pricing"], "1": ["snacks"] }, cohesion: { "0": 0.8, "1": 0.1 } },
  labels: { "0": "Finance", "1": "Facilities" }
};

describe.skipIf(!DatabaseSync)("SqliteGraphStore on node:sqlite (real FTS5)", () => {
  function freshStore() {
    const raw = new DatabaseSync(":memory:");
    runMigration(raw, readFileSync(MIGRATION, "utf8"));
    return createSqliteGraphStore(createNodeSqliteDatabase(raw));
  }

  it("loads graphify output and retrieves via FTS5 entry-point + 1-hop traversal", async () => {
    const store = freshStore();
    await loadGraphifyOutput(graphifyOutput, { store, ownerId: "o1" });

    const passages = await createGraphRetriever(store).retrieve({ text: "margin", topK: 10, ownerId: "o1" });
    const byFile = Object.fromEntries(passages.map((p) => [p.sourceFile, p]));

    expect(byFile["docs/margins.md"]).toBeTruthy(); // FTS hit
    expect(byFile["docs/margins.md"].communityLabel).toBe("Finance");
    expect(byFile["docs/pricing.md"]).toBeTruthy(); // 1-hop neighbour via the edge
    expect(byFile["docs/office.md"]).toBeUndefined(); // unrelated
  });

  it("is owner-scoped — another owner sees nothing", async () => {
    const store = freshStore();
    await loadGraphifyOutput(graphifyOutput, { store, ownerId: "o1" });
    const passages = await createGraphRetriever(store).retrieve({ text: "margin", topK: 10, ownerId: "intruder" });
    expect(passages).toHaveLength(0);
  });

  it("tolerates null source_location (migration NOT NULL + coercion hold)", async () => {
    const store = freshStore();
    await loadGraphifyOutput(
      {
        semantic: { nodes: [{ id: "og", label: "Open Graph image", file_type: "image", source_file: "public/og.png", source_location: null as any }], edges: [] },
        analysis: { communities: { "0": ["og"] } },
        labels: { "0": "Assets" }
      },
      { store, ownerId: "o1" }
    );
    const passages = await createGraphRetriever(store).retrieve({ text: "graph", topK: 5, ownerId: "o1" });
    expect(passages[0]?.sourceFile).toBe("public/og.png");
    expect(passages[0]?.sourceLocation).toBe("");
  });
});
