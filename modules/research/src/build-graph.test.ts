import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMemoryGraphStore } from "./graph";
import { runGraphBuild } from "./build-graph";

// Reuse the committed real graphify output as the "build result" the runner
// ingests after graphify (stubbed) "produces" it.
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "adapters", "__fixtures__", "graphify-out");
const owner = "user_1";

describe("runGraphBuild", () => {
  it("manual mode runs a full extract, then ingests the output", async () => {
    const store = createMemoryGraphStore();
    const calls: string[][] = [];
    const runGraphify = async (argv: string[]) => {
      calls.push(argv);
      return { ok: true as const };
    };
    const result = await runGraphBuild({ sourcesDir: "/opt/data/sources", outDir: OUT_DIR, mode: "manual", store, ownerId: owner, runGraphify });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data).toEqual({ nodes: 17, edges: 26, communities: 2 });
    // full extract = no --update
    expect(calls).toEqual([["extract", "/opt/data/sources"]]);
    const found = await store.searchNodes({ text: "auth", ownerId: owner, limit: 5 });
    expect(found.length).toBeGreaterThan(0);
  });

  it("cron mode runs an incremental extract (--update)", async () => {
    const store = createMemoryGraphStore();
    const calls: string[][] = [];
    const runGraphify = async (argv: string[]) => {
      calls.push(argv);
      return { ok: true as const };
    };
    const result = await runGraphBuild({ sourcesDir: "/opt/data/sources", outDir: OUT_DIR, mode: "cron", store, ownerId: owner, runGraphify });
    expect(result.ok).toBe(true);
    expect(calls).toEqual([["extract", "/opt/data/sources", "--update"]]);
  });

  it("fails without ingesting when graphify fails", async () => {
    const store = createMemoryGraphStore();
    let ingested = false;
    const runGraphify = async () => ({ ok: false as const, stderr: "no API key" });
    const result = await runGraphBuild({
      sourcesDir: "/opt/data/sources",
      outDir: OUT_DIR,
      mode: "manual",
      store,
      ownerId: owner,
      runGraphify,
      read: async () => {
        ingested = true;
        return "{}";
      }
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("GRAPHIFY_BUILD_FAILED");
    expect(result.error.message).toContain("no API key");
    expect(ingested).toBe(false);
  });
});
