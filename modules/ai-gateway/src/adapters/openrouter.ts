import type { ProviderClient } from "../index";

// OpenRouter (https://openrouter.ai) — an OpenAI-compatible BYOK proxy fronting
// many models (Anthropic, OpenAI, etc.). NOT the Anthropic SDK: this is raw HTTP
// against the OpenAI chat-completions shape. Model ids are namespaced, e.g.
// "anthropic/claude-3.5-haiku", "openai/gpt-4o-mini" — set in AiConfig.completeModel.
//
//   const provider = createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY! });
//   const providers = { openrouter: provider }; // AiConfig.provider = "openrouter"
//
// Embeddings aren't used here — GraphRAG retrieval uses FTS, not vectors.
export interface OpenRouterOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  // Optional OpenRouter attribution headers.
  referer?: string;
  title?: string;
}

export function createOpenRouterProvider(options: OpenRouterOptions): ProviderClient {
  const doFetch = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? "https://openrouter.ai/api/v1";

  return {
    async complete({ model, messages, maxTokens, temperature }) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      };
      if (options.referer) headers["HTTP-Referer"] = options.referer;
      if (options.title) headers["X-Title"] = options.title;

      const body: Record<string, unknown> = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens ?? 1024
      };
      if (temperature !== undefined) body.temperature = temperature;

      const response = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`OpenRouter request failed: ${response.status} ${detail}`.trim());
      }

      const json: any = await response.json();
      const text = String(json?.choices?.[0]?.message?.content ?? "");
      const usage = json?.usage ?? {};
      return {
        text,
        usage: {
          inputTokens: Number(usage.prompt_tokens ?? 0),
          outputTokens: Number(usage.completion_tokens ?? 0)
        }
      };
    },

    async embed() {
      throw new Error("OpenRouter provider: embeddings not supported here; GraphRAG retrieval uses FTS, not vectors.");
    }
  };
}
