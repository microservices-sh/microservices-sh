import type { ProviderClient } from "../index";

// Minimal shape of the Cloudflare Workers AI binding (env.AI). Typed structurally
// so the module doesn't depend on the exact @cloudflare/workers-types Ai signature.
export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<any>;
}

// Workers AI is the keyless default provider — billed to the tenant's own
// Cloudflare account. Good for embeddings (@cf/baai/bge-*) and small completions.
export function createWorkersAiProvider(ai: WorkersAiBinding): ProviderClient {
  return {
    async complete({ model, messages, maxTokens }) {
      const result = await ai.run(model, {
        messages,
        ...(maxTokens ? { max_tokens: maxTokens } : {})
      });
      const usage = result?.usage ?? {};
      return {
        text: String(result?.response ?? ""),
        usage: {
          inputTokens: Number(usage.prompt_tokens ?? 0),
          outputTokens: Number(usage.completion_tokens ?? 0)
        }
      };
    },

    async embed({ model, texts }) {
      const result = await ai.run(model, { text: texts });
      const vectors: number[][] = result?.data ?? [];
      const usage = result?.usage ?? {};
      return { vectors, usage: { tokens: Number(usage.prompt_tokens ?? usage.total_tokens ?? 0) } };
    }
  };
}
