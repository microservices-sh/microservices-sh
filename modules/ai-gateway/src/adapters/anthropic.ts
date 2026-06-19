import type { ProviderClient } from "../index";

// Structural shape of the official @anthropic-ai/sdk client. The real call site
// constructs it with the SDK and passes it in:
//
//   import Anthropic from "@anthropic-ai/sdk";
//   const client = new Anthropic({ apiKey: BYOK_KEY });
//   const provider = createAnthropicProvider(client);
//
// Use a current model id in AiConfig.completeModel, e.g. "claude-opus-4-8".
export interface AnthropicClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: { role: "user" | "assistant"; content: string }[];
    }): Promise<{ content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } }>;
  };
}

export function createAnthropicProvider(client: AnthropicClient): ProviderClient {
  return {
    async complete({ model, messages, maxTokens }) {
      // Anthropic takes `system` as a top-level param; messages carry only user/assistant.
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n");
      const conversation = messages
        .filter((message): message is { role: "user" | "assistant"; content: string } => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content }));

      // NOTE: temperature/top_p/top_k are intentionally NOT forwarded — Opus 4.8/4.7
      // reject sampling parameters with a 400. Steer via prompting instead.
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens ?? 1024,
        ...(system ? { system } : {}),
        messages: conversation
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");

      return {
        text,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
      };
    },

    async embed() {
      throw new Error("Anthropic has no embeddings API; use the workers-ai provider for embeddings.");
    }
  };
}
