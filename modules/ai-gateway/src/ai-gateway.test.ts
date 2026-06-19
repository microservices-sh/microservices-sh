import { describe, expect, it } from "vitest";
import { complete, embed } from "./index";

const owner = { id: "user_1", tenantId: "tenant_1", scopes: ["ai.invoke"] };

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };
function okData<R extends ResultLike>(result: R): Extract<R, { ok: true }>["data"] {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`);
  return result.data as Extract<R, { ok: true }>["data"];
}
function code(result: ResultLike): string {
  if (result.ok) throw new Error("expected error result");
  return (result.error as { code: string }).code;
}

const config = { provider: "workers-ai" as const, completeModel: "fast-1", embedModel: "embed-1" };

// Fake provider client (what a real Workers AI / Anthropic adapter implements).
function fakeProvider() {
  const calls: any[] = [];
  return {
    calls,
    async complete(input: any) {
      calls.push({ kind: "complete", ...input });
      return { text: `echo:${input.messages.at(-1).content}`, usage: { inputTokens: 10, outputTokens: 5 } };
    },
    async embed(input: any) {
      calls.push({ kind: "embed", ...input });
      return { vectors: input.texts.map(() => [0.1, 0.2]), usage: { tokens: 7 } };
    }
  };
}

describe("ai-gateway: complete", () => {
  it("routes to the configured provider and returns text + usage", async () => {
    const provider = fakeProvider();
    const result = await complete(
      { messages: [{ role: "user", content: "hi" }] },
      { config, providers: { "workers-ai": provider }, actor: owner }
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    const data = okData(result) as { text: string; usage: any; provider: string; model: string };
    expect(data.text).toBe("echo:hi");
    expect(data.provider).toBe("workers-ai");
    expect(data.model).toBe("fast-1");
    expect(provider.calls[0].model).toBe("fast-1");
  });

  it("meters token usage for the tenant", async () => {
    const provider = fakeProvider();
    const metered: any[] = [];
    const meter = { async record(u: any) { metered.push(u); } };
    await complete({ messages: [{ role: "user", content: "hi" }] }, { config, providers: { "workers-ai": provider }, actor: owner, meter });
    expect(metered).toHaveLength(1);
    expect(metered[0]).toMatchObject({ tenantId: "tenant_1", provider: "workers-ai", kind: "complete", inputTokens: 10, outputTokens: 5 });
  });
});

describe("ai-gateway: embed", () => {
  it("routes embeddings to the configured provider and returns vectors + usage", async () => {
    const provider = fakeProvider();
    const result = await embed({ texts: ["a", "b"] }, { config, providers: { "workers-ai": provider }, actor: owner });
    const data = okData(result) as { vectors: number[][]; usage: any };
    expect(data.vectors).toHaveLength(2);
    expect(provider.calls[0].model).toBe("embed-1");
  });
});

describe("ai-gateway: governance", () => {
  it("fails closed (401) with no actor", async () => {
    const result = await complete({ messages: [{ role: "user", content: "hi" }] }, { config, providers: { "workers-ai": fakeProvider() } } as any);
    expect(result.status).toBe(401);
  });

  it("forbids actors without ai.invoke scope (403)", async () => {
    const result = await complete(
      { messages: [{ role: "user", content: "hi" }] },
      { config, providers: { "workers-ai": fakeProvider() }, actor: { id: "u", scopes: [] } }
    );
    expect(result.status).toBe(403);
  });

  it("errors when the configured provider has no client (BYOK not set)", async () => {
    const result = await complete(
      { messages: [{ role: "user", content: "hi" }] },
      { config: { provider: "anthropic", completeModel: "claude", embedModel: "e" }, providers: {}, actor: owner }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(code(result)).toBe("AI_PROVIDER_NOT_CONFIGURED");
  });

  it("fails closed (429) and does not call the provider when the budget is exhausted", async () => {
    const provider = fakeProvider();
    const result = await complete(
      { messages: [{ role: "user", content: "hi" }] },
      { config, providers: { "workers-ai": provider }, actor: owner, budget: { remaining: () => 0 } }
    );
    expect(result.status).toBe(429);
    expect(code(result)).toBe("AI_BUDGET_EXCEEDED");
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects empty input (400)", async () => {
    const result = await complete({ messages: [] }, { config, providers: { "workers-ai": fakeProvider() }, actor: owner });
    expect(result.status).toBe(400);
    expect(code(result)).toBe("INVALID_AI_INPUT");
  });
});
