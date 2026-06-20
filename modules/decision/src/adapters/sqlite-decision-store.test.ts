import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSqliteDecisionStore, type SqlDatabase, type SqlStatement } from "./sqlite-decision-store";

let DatabaseSync: any;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = undefined;
}

function wrap(db: any): SqlDatabase {
  return {
    prepare(sql: string) {
      const native = db.prepare(sql);
      let args: unknown[] = [];
      const stmt: SqlStatement = {
        bind(...a: unknown[]) { args = a; return stmt; },
        async run() { return native.run(...args); },
        async all<T>() { return { results: native.all(...args) as T[] }; }
      };
      return stmt;
    }
  };
}

const brief = {
  id: "dec_1",
  question: "Raise prices?",
  context: "Margins down.",
  sources: [{ id: "rs_0", title: "docs/margins.md", uri: "research://brief/rsb_1#docs/margins.md" }],
  options: [{ id: "a", summary: "Raise 8%" }],
  risks: [{ summary: "Churn", severity: "medium" as const }],
  assumptions: ["inelastic"],
  recommendation: { summary: "Raise 8%", optionId: "a", sourceIds: ["rs_0"] },
  ownerId: "o1",
  status: "draft" as const,
  createdAt: "2026-06-19T00:00:00.000Z"
};

describe.skipIf(!DatabaseSync)("SqliteDecisionStore on node:sqlite", () => {
  it("round-trips a brief, appends an append-only log, and lists it", async () => {
    const raw = new DatabaseSync(":memory:");
    raw.exec(readFileSync("modules/decision/migrations/0001_decision.sql", "utf8"));
    const store = createSqliteDecisionStore(wrap(raw));

    await store.saveBrief(brief);
    const got = await store.getBrief("dec_1");
    expect(got?.recommendation.optionId).toBe("a");
    expect(got?.sources[0].title).toBe("docs/margins.md");

    await store.appendLog({ id: "dlog_1", briefId: "dec_1", choice: "accept", rationale: "go", ownerId: "o1", decidedAt: "2026-06-19T01:00:00.000Z" });
    await store.appendLog({ id: "dlog_2", briefId: "dec_1", choice: "defer", rationale: "wait", ownerId: "o1", decidedAt: "2026-06-19T02:00:00.000Z" });
    const logs = await store.listLogs("dec_1");
    expect(logs.map((l) => l.choice)).toEqual(["accept", "defer"]);
  });
});
