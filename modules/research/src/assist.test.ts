import { describe, expect, it } from "vitest";
import { createMemoryResearchStore } from "./index";
import type { OpsClient } from "./ops";
import { assistedBrief } from "./assist";

const NOW = 1_750_000_000_000;
const now = () => NOW;
const actor = { id: "owner_1", scopes: ["research.read", "ops.invoice.read"] };

const policyPassage = { sourceFile: "docs/refunds.md", sourceLocation: "L1", label: "Refund policy", score: 1, text: "Refunds within 7 days." };
const graphRetriever = { async retrieve() { return [policyPassage]; } };
const emptyRetriever = { async retrieve() { return []; } };

const invoiceClient: OpsClient = {
  async read(call) {
    return call.tool === "ops.invoice.read"
      ? [{ module: "invoice", entityId: "inv_9", asOf: NOW, label: "Invoice inv_9", text: "ACME overdue $1,200" }]
      : [];
  }
};
const emptyClient: OpsClient = { async read() { return []; } };

// Synthesizer that cites exactly the sources it was given.
const citingSynth = {
  async synthesize({ passages }: any) {
    return { answer: "Refunds are within 7 days; ACME has an overdue invoice.", citedSourceFiles: passages.map((p: any) => p.sourceFile) };
  }
};

describe("assistedBrief (blended graph + ops)", () => {
  it("blends a knowledge passage and a live operational record into one cited brief", async () => {
    const store = createMemoryResearchStore();
    const result = await assistedBrief(
      { question: "what's our refund policy and what does ACME owe?" },
      { graphRetriever, client: invoiceClient, store, synthesizer: citingSynth, now, actor }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const refs = result.data.brief.citations.map((c) => c.sourceFile);
    expect(refs).toContain("docs/refunds.md"); // graph (knowledge)
    expect(refs).toContain("invoice:inv_9"); // ops (live record)
    expect(result.data.planes).toEqual({ graph: 1, ops: 1 });
  });

  it("does not call ops tools for a pure knowledge question (graph-only)", async () => {
    const store = createMemoryResearchStore();
    let opsCalls = 0;
    const spyClient: OpsClient = { async read() { opsCalls++; return []; } };
    const result = await assistedBrief(
      { question: "what is our refund policy?" },
      { graphRetriever, client: spyClient, store, synthesizer: citingSynth, now, actor }
    );
    expect(result.ok).toBe(true);
    expect(opsCalls).toBe(0);
  });

  it("refuses when neither plane grounds the question", async () => {
    const store = createMemoryResearchStore();
    const result = await assistedBrief(
      { question: "what does ACME owe?" },
      { graphRetriever: emptyRetriever, client: emptyClient, store, synthesizer: citingSynth, now, actor }
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe("ASSIST_NO_SOURCES");
  });

  it("skips an ops tool the actor is not scoped for, still answering from the rest", async () => {
    const store = createMemoryResearchStore();
    const result = await assistedBrief(
      { question: "what does ACME owe?" },
      { graphRetriever, client: invoiceClient, store, synthesizer: citingSynth, now, actor: { id: "owner_1", scopes: ["research.read"] } }
    );
    // no ops.invoice.read scope → ops skipped, but graph still grounds it.
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.planes).toEqual({ graph: 1, ops: 0 });
  });

  it("skips an ops transport failure, still answering from graph passages", async () => {
    const store = createMemoryResearchStore();
    let denied = false;
    const throwingClient: OpsClient = {
      async read() {
        throw new Error("HTTP 404");
      }
    };
    const audit = {
      async record(entry: { action: string }) {
        if (entry.action === "ops.read_denied") denied = true;
      }
    };

    const result = await assistedBrief(
      { question: "what does ACME owe?" },
      { graphRetriever, client: throwingClient, store, synthesizer: citingSynth, now, actor, audit }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.planes).toEqual({ graph: 1, ops: 0 });
    expect(denied).toBe(true);
  });
});
