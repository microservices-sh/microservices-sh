import type { ProviderClient } from "../index";

// Gemma 4 can be served behind OpenAI-compatible runtimes such as vLLM,
// LM Studio, LiteLLM, or a Cloud Run/Vertex proxy. This adapter intentionally
// only handles text chat completions; document modules should pass OCR/layout
// text here and keep image/PDF handling in their own extraction runtime.
export interface GemmaOpenAiCompatibleOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
  defaultMaxTokens?: number;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function contentFromChoice(choice: any): string {
  const content = choice?.message?.content ?? choice?.text ?? "";
  return Array.isArray(content)
    ? content.map((part) => (typeof part === "string" ? part : String(part?.text ?? ""))).join("")
    : String(content);
}

export function createGemmaOpenAiCompatibleProvider(options: GemmaOpenAiCompatibleOptions): ProviderClient {
  const doFetch = options.fetch ?? globalThis.fetch;
  const baseUrl = trimTrailingSlash(options.baseUrl);

  return {
    async complete({ model, messages, maxTokens, temperature }) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options.headers
      };
      if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: maxTokens ?? options.defaultMaxTokens ?? 1024
      };
      if (temperature !== undefined) body.temperature = temperature;

      const response = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Gemma OpenAI-compatible request failed: ${response.status} ${detail}`.trim());
      }

      const json: any = await response.json();
      const usage = json?.usage ?? {};
      return {
        text: contentFromChoice(json?.choices?.[0]),
        usage: {
          inputTokens: Number(usage.prompt_tokens ?? 0),
          outputTokens: Number(usage.completion_tokens ?? 0)
        }
      };
    },

    async embed() {
      throw new Error("Gemma OpenAI-compatible adapter: embeddings are not implemented; use a dedicated embedding provider.");
    }
  };
}
