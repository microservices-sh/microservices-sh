import { describe, expect, it } from "vitest";
import { createOpenRouterProvider } from "./openrouter";

describe("openrouter adapter", () => {
  it("POSTs OpenAI-shaped chat completions with auth, and maps text + usage", async () => {
    const calls: any[] = [];
    const fakeFetch = async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [{ message: { role: "assistant", content: "the answer" } }],
            usage: { prompt_tokens: 30, completion_tokens: 9 }
          };
        },
        async text() { return ""; }
      } as any;
    };

    const provider = createOpenRouterProvider({ apiKey: "sk-or-test", fetch: fakeFetch as any });
    const result = await provider.complete({
      model: "anthropic/claude-3.5-haiku",
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "why?" }
      ],
      maxTokens: 512
    });

    expect(result.text).toBe("the answer");
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 9 });

    const { url, init } = calls[0];
    expect(url).toContain("/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-or-test");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("anthropic/claude-3.5-haiku");
    expect(body.max_tokens).toBe(512);
    expect(body.messages).toEqual([
      { role: "system", content: "be terse" },
      { role: "user", content: "why?" }
    ]);
  });

  it("throws on a non-2xx response", async () => {
    const fakeFetch = async () => ({ ok: false, status: 401, async json() { return {}; }, async text() { return "no key"; } } as any);
    const provider = createOpenRouterProvider({ apiKey: "bad", fetch: fakeFetch as any });
    await expect(provider.complete({ model: "x", messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/401/);
  });

  it("does not support embeddings", async () => {
    const provider = createOpenRouterProvider({ apiKey: "k", fetch: (async () => ({})) as any });
    await expect(provider.embed({ model: "x", texts: ["a"] })).rejects.toThrow(/embedding/i);
  });
});
