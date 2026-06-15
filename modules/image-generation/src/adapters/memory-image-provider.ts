import type { ImageProvider } from "../ports";
import type { ImageProviderId, ProviderEditInput, ProviderGenerateInput, ProviderImageResult } from "../types";

// Deterministic in-memory provider for tests. Returns tiny fake PNG bytes derived
// from the prompt so assertions are stable. Optionally configured to fail.
export function createMemoryImageProvider(opts?: {
  id?: ImageProviderId;
  fail?: () => never;
  mimeType?: string;
}): ImageProvider {
  const id = opts?.id ?? "kie-ai";
  const mimeType = opts?.mimeType ?? "image/png";

  function make(prompt: string): ProviderImageResult {
    if (opts?.fail) opts.fail();
    return {
      imageBytes: new TextEncoder().encode(`fake-image:${id}:${prompt}`),
      mimeType,
      usage: { inputTokens: 10, outputTokens: 100 },
    };
  }

  return {
    id,
    async generate(input: ProviderGenerateInput) {
      return make(input.prompt);
    },
    async edit(input: ProviderEditInput) {
      return make(input.prompt);
    },
  };
}
