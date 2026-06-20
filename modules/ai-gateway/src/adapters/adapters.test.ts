import { describe, expect, it } from "vitest";
import { createWorkersAiProvider } from "./workers-ai";
import { createAnthropicProvider } from "./anthropic";
import { createGemmaOllamaProvider } from "./gemma-ollama";
import { createGemmaOpenAiCompatibleProvider } from "./gemma-openai-compatible";

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

describe("gemma ollama adapter", () => {
  it("maps Ollama chat responses and usage", async () => {
    const calls: any[] = [];
    const provider = createGemmaOllamaProvider({
      baseUrl: "http://ollama.test",
      fetch: async (url: any, init: any) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return new Response(JSON.stringify({ message: { content: "{\"ok\":true}" }, prompt_eval_count: 11, eval_count: 4 }));
      }
    });

    const result = await provider.complete({
      model: "gemma4:e2b",
      messages: [{ role: "user", content: "extract" }],
      maxTokens: 128,
      temperature: 0
    });

    expect(result.text).toBe("{\"ok\":true}");
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 4 });
    expect(calls[0].url).toBe("http://ollama.test/api/chat");
    expect(calls[0].body).toMatchObject({ model: "gemma4:e2b", stream: false, options: { num_predict: 128, temperature: 0 } });
  });
});

describe("gemma openai-compatible adapter", () => {
  it("maps OpenAI-compatible chat responses and optional auth", async () => {
    const calls: any[] = [];
    const provider = createGemmaOpenAiCompatibleProvider({
      baseUrl: "https://vllm.test/v1/",
      apiKey: "sk-test",
      fetch: async (url: any, init: any) => {
        calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        return new Response(JSON.stringify({
          choices: [{ message: { content: "{\"vendor\":\"Acme\"}" } }],
          usage: { prompt_tokens: 22, completion_tokens: 8 }
        }));
      }
    });

    const result = await provider.complete({
      model: "google/gemma-4-12b-it",
      messages: [{ role: "user", content: "normalize invoice" }]
    });

    expect(result.text).toBe("{\"vendor\":\"Acme\"}");
    expect(result.usage).toEqual({ inputTokens: 22, outputTokens: 8 });
    expect(calls[0].url).toBe("https://vllm.test/v1/chat/completions");
    expect(calls[0].headers.Authorization).toBe("Bearer sk-test");
    expect(calls[0].body.model).toBe("google/gemma-4-12b-it");
  });
});
