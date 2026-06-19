import { describe, expect, it } from "vitest";
import { createGraphRetriever, createMemoryGraphStore, loadGraphifyOutput } from "./graph";

const owner = { id: "user_1", scopes: ["research.read"] };
const stranger = { id: "user_2", scopes: ["research.read"] };

// Mirrors the real graphify output schema (semantic.json + analysis.json + labels.json).
const graphifyOutput = {
  semantic: {
    nodes: [
      { id: "margins_doc", label: "Margin report", file_type: "document", source_file: "docs/margins.md", source_location: "L1" },
      { id: "pricing", label: "Pricing policy", file_type: "document", source_file: "docs/pricing.md", source_location: "L10" },
      { id: "snacks", label: "Office snacks", file_type: "document", source_file: "docs/office.md", source_location: "L3" }
    ],
    edges: [
      { source: "margins_doc", target: "pricing", relation: "references", weight: 1.0, source_file: "docs/margins.md", source_location: "L1" }
    ]
  },
  analysis: {
    communities: { "0": ["margins_doc", "pricing"], "1": ["snacks"] },
    cohesion: { "0": 0.8, "1": 0.1 }
  },
  labels: { "0": "Finance", "1": "Facilities" }
};

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };
function okData<R extends ResultLike>(r: R): Extract<R, { ok: true }>["data"] {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data as Extract<R, { ok: true }>["data"];
}

describe("graph: loadGraphifyOutput", () => {
  it("loads graphify nodes/edges/communities into the store, owned by the actor", async () => {
    const store = createMemoryGraphStore();
    const result = await loadGraphifyOutput(graphifyOutput, { store, ownerId: owner.id });
    const counts = okData(result) as { nodes: number; edges: number; communities: number };
    expect(counts).toEqual({ nodes: 3, edges: 1, communities: 2 });

    const found = await store.searchNodes({ text: "margin", ownerId: owner.id, limit: 10 });
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("margins_doc");
    expect(found[0].sourceFile).toBe("docs/margins.md");
    expect(found[0].communityId).toBe(0);
    expect(found[0].ownerId).toBe("user_1");
  });

  it("scopes node search to the owner", async () => {
    const store = createMemoryGraphStore();
    await loadGraphifyOutput(graphifyOutput, { store, ownerId: owner.id });
    const found = await store.searchNodes({ text: "margin", ownerId: stranger.id, limit: 10 });
    expect(found).toHaveLength(0);
  });
});

describe("graph: GraphRetriever", () => {
  async function loadedStore() {
    const store = createMemoryGraphStore();
    await loadGraphifyOutput(graphifyOutput, { store, ownerId: owner.id });
    return store;
  }

  it("returns the matched node plus 1-hop neighbours, with source + community labels", async () => {
    const retriever = createGraphRetriever(await loadedStore());
    const passages = await retriever.retrieve({ text: "margin", topK: 10, ownerId: owner.id });

    const byFile = Object.fromEntries(passages.map((p) => [p.sourceFile, p]));
    // matched node
    expect(byFile["docs/margins.md"]).toBeTruthy();
    expect(byFile["docs/margins.md"].communityLabel).toBe("Finance");
    // 1-hop neighbour via the "references" edge
    expect(byFile["docs/pricing.md"]).toBeTruthy();
    // unrelated node not pulled in
    expect(byFile["docs/office.md"]).toBeUndefined();
  });

  it("returns nothing for another owner (graph is owner-scoped)", async () => {
    const retriever = createGraphRetriever(await loadedStore());
    const passages = await retriever.retrieve({ text: "margin", topK: 10, ownerId: stranger.id });
    expect(passages).toHaveLength(0);
  });
});
