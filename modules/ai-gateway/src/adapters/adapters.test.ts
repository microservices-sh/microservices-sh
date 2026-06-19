import { describe, expect, it } from "vitest";
import { createWorkersAiProvider } from "./workers-ai";
import { createAnthropicProvider } from "./anthropic";

describe("workers-ai adapter", () => {
  it("completes via env.AI.run and maps response + usage", async () => {
    const calls: any[] = [];
    const ai = {
      async run(model: string, input: any) {
        calls.push({ model, input });
        return { response: "hello there", usage: { prompt_tokens: 12, completion_tokens: 3 } };
      }
    };
    const provider = createWorkersAiProvider(ai);

    const result = await provider.complete({
      model: "@cf/meta/llama-3.1-8b-instruct",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 256
    });

    expect(result.text).toBe("hello there");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
    expect(calls[0].model).toBe("@cf/meta/llama-3.1-8b-instruct");
    expect(calls[0].input.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("embeds via env.AI.run and returns vectors", async () => {
    const ai = {
      async run(_model: string, input: any) {
        return { data: input.text.map(() => [0.1, 0.2, 0.3]) };
      }
    };
    const provider = createWorkersAiProvider(ai);
    const result = await provider.embed({ model: "@cf/baai/bge-base-en-v1.5", texts: ["a", "b"] });
    expect(result.vectors).toHaveLength(2);
    expect(result.vectors[0]).toEqual([0.1, 0.2, 0.3]);
  });
});

describe("anthropic adapter", () => {
  it("splits system from messages, omits temperature, and maps usage", async () => {
    const calls: any[] = [];
    // Structurally matches the @anthropic-ai/sdk client (client.messages.create).
    const client = {
      messages: {
        async create(params: any) {
          calls.push(params);
          return { content: [{ type: "text", text: "the answer" }], usage: { input_tokens: 20, output_tokens: 7 } };
        }
      }
    };
    const provider = createAnthropicProvider(client);

    const result = await provider.complete({
      model: "claude-opus-4-8",
      messages: [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Why?" }
      ],
      maxTokens: 512,
      temperature: 0.7 // must be dropped — Opus 4.8 rejects sampling params
    });

    expect(result.text).toBe("the answer");
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 7 });

    const sent = calls[0];
    expect(sent.model).toBe("claude-opus-4-8");
    expect(sent.max_tokens).toBe(512);
    expect(sent.system).toBe("You are terse.");
    expect(sent.messages).toEqual([{ role: "user", content: "Why?" }]);
    expect("temperature" in sent).toBe(false);
  });

  it("does not support embeddings (Anthropic has no embeddings API)", async () => {
    const provider = createAnthropicProvider({ messages: { async create() { return {}; } } });
    await expect(provider.embed({ model: "x", texts: ["a"] })).rejects.toThrow(/embedding/i);
  });
});
