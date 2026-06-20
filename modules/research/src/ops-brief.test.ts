import { describe, expect, it } from "vitest";
import { createMemoryResearchStore } from "./index";
import type { OpsClient, OpsRecord } from "./ops";
import { operationalBrief } from "./ops-brief";

const NOW = 1_750_000_000_000;
const now = () => NOW;
const actor = { id: "owner_1", scopes: ["ops.invoice.read"] };

const overdue: OpsRecord = {
  module: "invoice",
  entityId: "inv_42",
  asOf: NOW,
  label: "Invoice inv_42 — ACME — overdue",
  text: "Invoice inv_42 for ACME, $1,200, overdue since 2026-06-01."
};

function clientReturning(records: OpsRecord[]): OpsClient {
  return { async read() { return records; } };
}

// Synthesizer that answers citing exactly the retrieved record refs.
const citingSynth = {
  async synthesize({ passages }: any) {
    return { answer: "ACME has 1 overdue invoice totalling $1,200.", citedSourceFiles: passages.map((p: any) => p.sourceFile) };
  }
};

describe("operationalBrief", () => {
  it("produces a cited brief grounded in live operational records", async () => {
    const store = createMemoryResearchStore();
    const result = await operationalBrief(
      { question: "What does ACME owe?", tool: "ops.invoice.read", args: { customer: "ACME" } },
      { client: clientReturning([overdue]), store, synthesizer: citingSynth, now, actor }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.brief.answer).toContain("overdue");
    expect(result.data.brief.citations).toEqual([{ sourceFile: "invoice:inv_42" }]);
    expect(result.data.brief.ownerId).toBe("owner_1");

    // persisted + event emitted
    const saved = await store.getBrief(result.data.brief.id);
    expect(saved).not.toBeNull();
    expect(store.listEvents().at(-1)).toMatchObject({ eventName: "research.brief_created" });
  });

  it("refuses (cite-or-refuse) when there are no operational records", async () => {
    const store = createMemoryResearchStore();
    const result = await operationalBrief(
      { question: "What does NOBODY owe?", tool: "ops.invoice.read", args: {} },
      { client: clientReturning([]), store, synthesizer: citingSynth, now, actor }
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("OPS_NO_SOURCES");
  });

  it("rejects synthesis that cites a record it was not given", async () => {
    const store = createMemoryResearchStore();
    const fabricating = { async synthesize() { return { answer: "made up", citedSourceFiles: ["invoice:inv_999"] }; } };
    const result = await operationalBrief(
      { question: "What does ACME owe?", tool: "ops.invoice.read", args: {} },
      { client: clientReturning([overdue]), store, synthesizer: fabricating, now, actor }
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("OPS_UNCITED");
  });

  it("propagates the governance refusal when the actor lacks the tool scope (no brief saved)", async () => {
    const store = createMemoryResearchStore();
    const result = await operationalBrief(
      { question: "What does ACME owe?", tool: "ops.invoice.read", args: {} },
      { client: clientReturning([overdue]), store, synthesizer: citingSynth, now, actor: { id: "owner_1", scopes: [] } }
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("OPS_FORBIDDEN");
    expect(store.listEvents()).toHaveLength(0);
  });
});
