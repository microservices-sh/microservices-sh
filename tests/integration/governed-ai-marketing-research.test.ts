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
  runResearch,
  createMemoryMarketingStore,
  type Signal,
  type SocialListenPort
} from "../../modules/marketing-research/src/index";
import { createGatewaySynthesizer } from "../../modules/marketing-research/src/adapters/gateway-synthesizer";

// ───────────────────────────────────────────────────────────────────────────
// CONTRACT — marketing-research's Synthesizer composed through the governed-AI
// kit (plan 34). The module is dep-free: it takes a `complete` closure, which the
// kit's `ai.complete` satisfies. No template wires this today (saas-starter
// dropped marketing-research in the lean-core strip), so this locks the
// composition contract and is the reference wiring. Proves three things compose:
// governed egress (meter/audit/budget), AND the module's cite-or-refuse guard.
// ───────────────────────────────────────────────────────────────────────────

const REAL_URL = "https://reddit.com/r/saas/comments/abc";
const actor = { id: "owner_1", tenantId: "tenant_1", scopes: ["marketing.run", "ai.invoke"] };
const config = { provider: "openrouter" as const, completeModel: "fast-1", embedModel: "embed-1" };
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

const signals: Signal[] = [
  { source: "reddit", sourceUrl: REAL_URL, title: "Founders complain about prod-readiness", excerpt: "auth + multi-tenant keep biting", engagement: 128 }
];
const listen: SocialListenPort = {
  async listen() {
    return { signals, coverage: { searched: ["reddit"], returned: ["reddit"] } };
  }
};

// Provider that returns the synthesis JSON the gateway-synthesizer parses.
function fakeProvider(synthesis: { summary: string; implications: string[]; citedSourceUrls: string[] }) {
  const calls: unknown[] = [];
  return {
    calls,
    async complete(input: unknown) {
      calls.push(input);
      return { text: JSON.stringify(synthesis), usage: { inputTokens: 200, outputTokens: 60 } };
    },
    async embed(input: { texts: string[] }) {
      return { vectors: input.texts.map(() => [0]), usage: { tokens: 1 } };
    }
  };
}

describe("CONTRACT — governed AI marketing research (marketing-research × ai-gateway)", () => {
  it("produces a cited brief through the governed synthesizer and meters + audits the call", async () => {
    const provider = fakeProvider({ summary: "Strong demand", implications: ["Lead with prod-readiness"], citedSourceUrls: [REAL_URL] });
    const metered: unknown[] = [];
    const audited: unknown[] = [];
    const ai = createGovernedAi({
      config,
      providers: { openrouter: provider },
      actor,
      meter: usageMeter((u) => metered.push(u)),
      audit: auditSink((e) => audited.push(e))
    });

    const r = await runResearch(
      { topic: "production-readiness for AI apps" },
      { store: createMemoryMarketingStore(), listen, synthesizer: createGatewaySynthesizer(ai.complete), now: () => T0, actor }
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.brief.summary).toBe("Strong demand");
      expect(r.data.brief.citations.map((c) => c.sourceUrl)).toEqual([REAL_URL]);
    }
    // Governance ran on the AI egress.
    expect(provider.calls).toHaveLength(1);
    expect(metered).toHaveLength(1);
    expect(metered[0]).toMatchObject({ tenantId: "tenant_1", kind: "complete" });
    expect(audited[0]).toMatchObject({ action: "ai.complete", actorId: "owner_1" });
  });

  it("cite-or-refuse still bites through the governed path — a hallucinated URL is rejected (422)", async () => {
    const provider = fakeProvider({ summary: "made up", implications: ["x"], citedSourceUrls: ["https://hallucinated.example/not-a-signal"] });
    const ai = createGovernedAi({ config, providers: { openrouter: provider }, actor });

    const r = await runResearch(
      { topic: "anything" },
      { store: createMemoryMarketingStore(), listen, synthesizer: createGatewaySynthesizer(ai.complete), now: () => T0, actor }
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("MARKETING_UNCITED");
  });

  it("fails closed when the tenant AI budget is exhausted — research rejects, no brief", async () => {
    const provider = fakeProvider({ summary: "x", implications: [], citedSourceUrls: [REAL_URL] });
    const ai = createGovernedAi({ config, providers: { openrouter: provider }, actor, budget: staticBudget(0) });

    await expect(
      runResearch(
        { topic: "x" },
        { store: createMemoryMarketingStore(), listen, synthesizer: createGatewaySynthesizer(ai.complete), now: () => T0, actor }
      )
    ).rejects.toThrow(/429|AI_BUDGET/);
    expect(provider.calls).toHaveLength(0);
  });
});
