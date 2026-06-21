import { describe, it, expect } from "vitest";
// Relative imports: neither module is root-hoisted, so this stays dependency-free
// (no lockfile change) while exercising the REAL module source.
import {
  createGovernedAi,
  staticBudget,
  usageMeter,
  auditSink
} from "../../modules/ai-gateway/src/index";
import {
  createGemmaExtractionNormalizer,
  normalizeExtraction
} from "../../modules/document-extraction/src/index";

// ───────────────────────────────────────────────────────────────────────────
// CONTRACT — document-extraction's "ai-gateway" runtime composed through the
// governed-AI kit (plan 34). document-extraction's normalizer takes a
// CompletionClient; the kit's `completionClient` is that shape. This is the
// reference wiring for a server /extract route (the desktop path runs Gemma
// locally in Rust and is governed separately). Proves: a governed extraction
// produces a draft AND is metered + audited, and an over-budget extraction
// fails closed (no draft).
// ───────────────────────────────────────────────────────────────────────────

const actor = { id: "user_1", tenantId: "tenant_1", scopes: ["ai.invoke"] };
const config = { provider: "gemma-openai-compatible" as const, completeModel: "gemma4:e4b", embedModel: "embed-1" };

// A provider that returns a valid extraction draft as JSON (what a real Gemma
// adapter would produce). Records calls so we can assert governance ran first.
function fakeProvider() {
  const calls: unknown[] = [];
  return {
    calls,
    async complete(input: unknown) {
      calls.push(input);
      const draft = JSON.stringify({ confidence: 0.92, summary: "Invoice from Acme Co.", fields: [], tables: [], warnings: [] });
      return { text: draft, usage: { inputTokens: 120, outputTokens: 40 } };
    },
    async embed(input: { texts: string[] }) {
      return { vectors: input.texts.map(() => [0]), usage: { tokens: 1 } };
    }
  };
}

const sampleInput = {
  tenantId: "tenant_1",
  schemaId: "invoice.v1",
  targetType: "invoice" as const,
  runtime: "ai-gateway" as const,
  rawText: "ACME CO\nInvoice 42\nTotal: $100.00",
  documentName: "invoice-42.pdf"
};

describe("CONTRACT — governed AI extraction (document-extraction × ai-gateway)", () => {
  it("normalizes through the governed completionClient and meters + audits the call", async () => {
    const provider = fakeProvider();
    const metered: unknown[] = [];
    const audited: unknown[] = [];
    const ai = createGovernedAi({
      config,
      providers: { "gemma-openai-compatible": provider },
      actor,
      meter: usageMeter((u) => metered.push(u)),
      audit: auditSink((e) => audited.push(e))
    });

    const normalizer = createGemmaExtractionNormalizer({ client: ai.completionClient });
    const result = await normalizeExtraction(sampleInput, { normalizer });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.draft.schemaId).toBe("invoice.v1");
      expect(result.data.draft.targetType).toBe("invoice");
      expect(result.data.draft.runtime).toBe("ai-gateway");
      expect(result.data.draft.confidence).toBeCloseTo(0.92);
    }
    // Governance ran: the provider was reached (authz/budget passed) and the call
    // was metered + audited through the gateway.
    expect(provider.calls).toHaveLength(1);
    expect(metered).toHaveLength(1);
    expect(metered[0]).toMatchObject({ tenantId: "tenant_1", kind: "complete" });
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({ action: "ai.complete", actorId: "user_1" });
  });

  it("fails closed when the tenant AI budget is exhausted — no draft, provider never called", async () => {
    const provider = fakeProvider();
    const ai = createGovernedAi({
      config,
      providers: { "gemma-openai-compatible": provider },
      actor,
      budget: staticBudget(0)
    });
    const normalizer = createGemmaExtractionNormalizer({ client: ai.completionClient });

    // The governed completionClient throws on the gateway's 429, so normalize
    // rejects — an over-budget extraction cannot produce a draft.
    await expect(normalizeExtraction(sampleInput, { normalizer })).rejects.toThrow(/429|AI_BUDGET/);
    expect(provider.calls).toHaveLength(0);
  });
});
