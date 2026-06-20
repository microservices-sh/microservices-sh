import type { ProviderClient } from "../index";

// Local/sidecar Gemma via Ollama. Use AiConfig.completeModel for the installed
// Ollama model name, e.g. "gemma4:e2b" or a locally aliased quantized model.
export interface GemmaOllamaOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  keepAlive?: string;
  defaultMaxTokens?: number;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function createGemmaOllamaProvider(options: GemmaOllamaOptions = {}): ProviderClient {
  const doFetch = options.fetch ?? globalThis.fetch;
  const baseUrl = trimTrailingSlash(options.baseUrl ?? "http://127.0.0.1:11434");

  return {
    async complete({ model, messages, maxTokens, temperature }) {
      const numPredict = maxTokens ?? options.defaultMaxTokens;
      const body: Record<string, unknown> = {
        model,
        messages,
        stream: false,
        options: {
          ...(numPredict ? { num_predict: numPredict } : {}),
          ...(temperature !== undefined ? { temperature } : {})
        }
      };
      if (options.keepAlive) body.keep_alive = options.keepAlive;

      const response = await doFetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Gemma Ollama request failed: ${response.status} ${detail}`.trim());
      }

      const json: any = await response.json();
      return {
        text: String(json?.message?.content ?? json?.response ?? ""),
        usage: {
          inputTokens: Number(json?.prompt_eval_count ?? 0),
          outputTokens: Number(json?.eval_count ?? 0)
        }
      };
    },

    async embed() {
      throw new Error("Gemma Ollama adapter: embeddings are not implemented; use a dedicated embedding provider.");
    }
  };
}
