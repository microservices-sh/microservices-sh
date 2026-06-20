import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createNodeSqliteDatabase, runMigration } from "./node-sqlite-graph";
import { createSqliteResearchStore } from "./sqlite-research-store";

let DatabaseSync: any;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = undefined;
}

describe.skipIf(!DatabaseSync)("SqliteResearchStore on node:sqlite", () => {
  it("round-trips a brief and records an event", async () => {
    const raw = new DatabaseSync(":memory:");
    runMigration(raw, readFileSync("modules/research/migrations/0001_research.sql", "utf8"));
    const store = createSqliteResearchStore(createNodeSqliteDatabase(raw));

    await store.saveBrief({
      id: "rsb_1",
      question: "Why did margins fall?",
      answer: "Costs rose.",
      citations: [{ sourceFile: "docs/margins.md" }],
      ownerId: "o1",
      createdAt: "2026-06-19T00:00:00.000Z"
    });
    await store.writeEvent({ eventName: "research.brief_created", entityType: "research_brief", entityId: "rsb_1", payload: { ownerId: "o1" } });

    const got = await store.getBrief("rsb_1");
    expect(got?.answer).toBe("Costs rose.");
    expect(got?.citations).toEqual([{ sourceFile: "docs/margins.md" }]);
    expect(await store.getBrief("missing")).toBeNull();
  });
});
