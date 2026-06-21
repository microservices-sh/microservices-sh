import { describe, expect, it } from "vitest";
import { createGovernedAi, staticBudget, budgetFrom, usageMeter, auditSink } from "./index";

const owner = { id: "user_1", tenantId: "tenant_1", scopes: ["ai.invoke"] };
const config = { provider: "workers-ai" as const, completeModel: "fast-1", embedModel: "embed-1" };

function fakeProvider() {
  const calls: any[] = [];
  return {
    calls,
    async complete(input: any) {
      calls.push(input);
      return { text: `echo:${input.messages.at(-1).content}`, usage: { inputTokens: 10, outputTokens: 5 } };
    },
    async embed(input: any) {
      calls.push(input);
      return { vectors: input.texts.map(() => [0.1, 0.2]), usage: { tokens: 7 } };
    }
  };
}

describe("ai-gateway: createGovernedAi (governed kit, plan 34 step 0)", () => {
  it("complete closure routes through the gateway with metering + audit wired once", async () => {
    const provider = fakeProvider();
    const metered: any[] = [];
    const audited: any[] = [];
    const ai = createGovernedAi({
      config,
      providers: { "workers-ai": provider },
      actor: owner,
      meter: usageMeter((u) => metered.push(u)),
      audit: auditSink((e) => audited.push(e))
    });

    const r = await ai.complete([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.text).toBe("echo:hi");
      expect(r.data.provider).toBe("workers-ai");
    }
    expect(metered).toHaveLength(1);
    expect(metered[0]).toMatchObject({ tenantId: "tenant_1", kind: "complete" });
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({ action: "ai.complete", actorId: "user_1" });
  });

  it("the complete closure satisfies the CompleteFn shape the bridge adapters take", async () => {
    const ai = createGovernedAi({ config, providers: { "workers-ai": fakeProvider() }, actor: owner });
    // research/decision/marketing-research bridges expect: (messages) => Promise<{ ok, ... }>
    const fn: (m: { role: "system" | "user" | "assistant"; content: string }[]) => Promise<{ ok: boolean }> = ai.complete;
    expect((await fn([{ role: "user", content: "x" }])).ok).toBe(true);
  });

  it("fails closed (429) when the budget is exhausted — before any provider call", async () => {
    const provider = fakeProvider();
    const ai = createGovernedAi({ config, providers: { "workers-ai": provider }, actor: owner, budget: staticBudget(0) });
    const r = await ai.complete([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.error.code).toBe("AI_BUDGET_EXCEEDED");
    }
    expect(provider.calls).toHaveLength(0); // never reached the provider
  });

  it("budgetFrom evaluates remaining per call", async () => {
    let remaining = 100;
    const ai = createGovernedAi({ config, providers: { "workers-ai": fakeProvider() }, actor: owner, budget: budgetFrom(() => remaining) });
    expect((await ai.complete([{ role: "user", content: "a" }])).ok).toBe(true);
    remaining = 0;
    expect((await ai.complete([{ role: "user", content: "b" }])).ok).toBe(false);
  });

  it("completionClient returns {text,provider,model} and throws on a governed failure", async () => {
    const ai = createGovernedAi({ config, providers: { "workers-ai": fakeProvider() }, actor: owner });
    const out = await ai.completionClient.complete({ messages: [{ role: "user", content: "doc" }] });
    expect(out).toMatchObject({ text: "echo:doc", provider: "workers-ai", model: "fast-1" });

    const capped = createGovernedAi({ config, providers: { "workers-ai": fakeProvider() }, actor: owner, budget: staticBudget(0) });
    await expect(capped.completionClient.complete({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(/429|AI_BUDGET/);
  });

  it("embed closure routes through the gateway", async () => {
    const ai = createGovernedAi({ config, providers: { "workers-ai": fakeProvider() }, actor: owner });
    const r = await ai.embed(["a", "b"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.vectors).toHaveLength(2);
  });
});
