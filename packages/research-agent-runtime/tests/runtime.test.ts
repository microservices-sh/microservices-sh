import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createNodeSqliteDatabase, runMigration } from "@microservices-sh/research/adapters/node-sqlite-graph";
import { bootResearchRuntime } from "../src/runtime";

let DatabaseSync: any;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = undefined;
}

const actor = { id: "acme", tenantId: "acme", scopes: ["research.read", "decision.read", "decision.write", "ai.invoke"] };

const graphify = {
  semantic: {
    nodes: [
      { id: "margins_doc", label: "Margin report", file_type: "document", source_file: "docs/margins.md", source_location: "L1" },
      { id: "pricing", label: "Pricing policy", file_type: "document", source_file: "docs/pricing.md", source_location: "L10" }
    ],
    edges: [{ source: "margins_doc", target: "pricing", relation: "references", weight: 1.0 }]
  },
  analysis: { communities: { "0": ["margins_doc", "pricing"] } },
  labels: { "0": "Finance" }
};

// One fake provider serving both the research synthesizer and the decision
// proposer (branch on the prompt). No network/key.
const provider = {
  async complete({ messages }: { messages: { role: string; content: string }[] }) {
    const text = messages.map((m) => m.content).join("\n");
    if (text.includes("source_file=")) {
      return { text: '{"answer":"Margins fell on rising costs.","citations":["docs/margins.md"]}', usage: { inputTokens: 10, outputTokens: 5 } };
    }
    if (text.includes("cite by id")) {
      return { text: '{"options":[{"id":"a","summary":"Raise prices"}],"risks":[],"assumptions":[],"recommendation":{"summary":"Raise","optionId":"a","sourceIds":["rs_0"]}}', usage: { inputTokens: 10, outputTokens: 5 } };
    }
    return { text: "{}", usage: { inputTokens: 0, outputTokens: 0 } };
  },
  async embed() {
    throw new Error("no embed");
  }
};

describe.skipIf(!DatabaseSync)("bootResearchRuntime (real node:sqlite, fake provider)", () => {
  function boot() {
    const raw = new DatabaseSync(":memory:");
    runMigration(raw, readFileSync("modules/research/migrations/0001_research.sql", "utf8"));
    runMigration(raw, readFileSync("modules/decision/migrations/0001_decision.sql", "utf8"));
    return bootResearchRuntime({
      db: createNodeSqliteDatabase(raw),
      readContent: ({ sourceFile }) => `EXCERPT of ${sourceFile}: margins fell on rising costs.`,
      ai: { config: { provider: "openrouter", completeModel: "fake", embedModel: "" }, providers: { openrouter: provider } },
      now: () => Date.parse("2026-06-19T00:00:00.000Z")
    });
  }

  it("research → persist → decision-from-research → record, all over one SQLite DB", async () => {
    const rt = boot();
    await rt.loadGraph(graphify, "acme");

    // 1. research a question → cited brief
    const r = await rt.research({ question: "Summarize the margin report and pricing policy" }, actor);
    expect(r.ok).toBe(true);
    const researchBrief = (r as any).data.brief;
    expect(researchBrief.citations[0].sourceFile).toBe("docs/margins.md");

    // 2. persisted — reload from SQLite
    const reloaded = await rt.getResearchBrief(researchBrief.id, actor);
    expect(reloaded.ok).toBe(true);

    // 3. ground a decision in that research brief
    const d = await rt.draftDecisionFromResearch({ research: researchBrief }, actor);
    expect(d.ok).toBe(true);
    const decisionBrief = (d as any).data.brief;
    expect(decisionBrief.recommendation.sourceIds).toContain("rs_0");
    expect(decisionBrief.context).toBe("Margins fell on rising costs.");

    // 4. record the decision → append-only log
    const rec = await rt.recordDecision({ briefId: decisionBrief.id, choice: "accept", rationale: "Justified" }, actor);
    expect(rec.ok).toBe(true);
    const history = (await rt.listDecisions(decisionBrief.id, actor)) as any;
    expect(history.data.logs).toHaveLength(1);
    expect(history.data.logs[0].choice).toBe("accept");
  });

  it("assist blends the local graph with a live ops read-back when an opsClient is wired", async () => {
    const opsActor = { id: "acme", tenantId: "acme", scopes: ["research.read", "ai.invoke", "ops.invoice.read"] };
    const opsCalls: string[] = [];
    const raw = new DatabaseSync(":memory:");
    runMigration(raw, readFileSync("modules/research/migrations/0001_research.sql", "utf8"));
    runMigration(raw, readFileSync("modules/decision/migrations/0001_decision.sql", "utf8"));
    const rt = bootResearchRuntime({
      db: createNodeSqliteDatabase(raw),
      readContent: ({ sourceFile }) => `EXCERPT of ${sourceFile}: margins fell on rising costs.`,
      ai: { config: { provider: "openrouter", completeModel: "fake", embedModel: "" }, providers: { openrouter: provider } },
      now: () => Date.parse("2026-06-19T00:00:00.000Z"),
      opsClient: {
        async read(call) {
          opsCalls.push(call.tool);
          return call.tool === "ops.invoice.read"
            ? [{ module: "invoice", entityId: "inv_9", asOf: 1, label: "Invoice inv_9", text: "ACME overdue $1,200" }]
            : [];
        }
      }
    });
    await rt.loadGraph(graphify, "acme");

    const r = await rt.assist({ question: "Summarize the margin report — and what does ACME owe?" }, opsActor);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    // The planner routed the "owe" question to the invoice tool, and it was read.
    expect(opsCalls).toContain("ops.invoice.read");
    expect(r.data.planes.ops).toBe(1);
    expect(r.data.planes.graph).toBeGreaterThan(0);
  });
});
