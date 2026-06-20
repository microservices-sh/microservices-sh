import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGraphRetriever, createMemoryGraphStore } from "../graph";
import { loadGraphifyDir } from "./graphify-out-loader";

// Golden fixture: a real `graphify extract` output (17 nodes / 26 edges / 2
// communities). Committed so a graphify schema change breaks this test, not prod.
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "graphify-out");
const owner = { id: "user_1" };

describe("loadGraphifyDir", () => {
  it("reads real graphify-out/graph.json into the store, owned by the actor", async () => {
    const store = createMemoryGraphStore();
    const result = await loadGraphifyDir(FIXTURE_DIR, { store, ownerId: owner.id });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data).toEqual({ nodes: 17, edges: 26, communities: 2 });

    const found = await store.searchNodes({ text: "auth", ownerId: owner.id, limit: 10 });
    expect(found.length).toBeGreaterThan(0);
    const authDoc = found.find((n) => n.id === "auth_document");
    expect(authDoc).toBeDefined();
    expect(authDoc!.sourceFile).toBe("auth.md");
    expect(authDoc!.communityId).toBe(1);
    expect(authDoc!.ownerId).toBe("user_1");
  });

  it("derives community labels from each node's community_name", async () => {
    const store = createMemoryGraphStore();
    await loadGraphifyDir(FIXTURE_DIR, { store, ownerId: owner.id });
    const community = await store.getCommunity(1, { ownerId: owner.id });
    expect(community?.label).toBe("Authentication and Sessions");
  });

  it("retrieves a cited passage for a question over the loaded graph", async () => {
    const store = createMemoryGraphStore();
    await loadGraphifyDir(FIXTURE_DIR, { store, ownerId: owner.id });
    const retriever = createGraphRetriever(store);
    const passages = await retriever.retrieve({ text: "billing refunds", topK: 5, ownerId: owner.id });
    expect(passages.length).toBeGreaterThan(0);
    expect(passages.every((p) => typeof p.sourceFile === "string" && p.sourceFile.length > 0)).toBe(true);
  });

  it("scopes loaded nodes to the owner", async () => {
    const store = createMemoryGraphStore();
    await loadGraphifyDir(FIXTURE_DIR, { store, ownerId: owner.id });
    const found = await store.searchNodes({ text: "auth", ownerId: "stranger", limit: 10 });
    expect(found).toHaveLength(0);
  });

  it("returns a typed error when graph.json is absent", async () => {
    const store = createMemoryGraphStore();
    const read = async (path: string) => {
      const err = new Error(`ENOENT: ${path}`) as Error & { code: string };
      err.code = "ENOENT";
      throw err;
    };
    const result = await loadGraphifyDir("/nope", { store, ownerId: owner.id }, read);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("GRAPH_JSON_MISSING");
  });

  it("returns a typed error when graph.json lacks the links array", async () => {
    const store = createMemoryGraphStore();
    const read = async (path: string) => {
      if (path.endsWith("graph.json")) return JSON.stringify({ nodes: [] });
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    };
    const result = await loadGraphifyDir("/x", { store, ownerId: owner.id }, read);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("GRAPH_JSON_INVALID");
    expect(result.error.message).toContain("links");
  });

  it("ignores missing .graphify_analysis.json (cohesion is optional enrichment)", async () => {
    const store = createMemoryGraphStore();
    const minimalGraph = {
      nodes: [{ id: "n1", label: "Node One", file_type: "document", source_file: "a.md", source_location: null, community: 0, community_name: "Group A" }],
      links: []
    };
    const read = async (path: string) => {
      if (path.endsWith("graph.json")) return JSON.stringify(minimalGraph);
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); // analysis file absent
    };
    const result = await loadGraphifyDir("/x", { store, ownerId: owner.id }, read);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data).toEqual({ nodes: 1, edges: 0, communities: 1 });
    const community = await store.getCommunity(0, { ownerId: owner.id });
    expect(community?.label).toBe("Group A");
  });
});
