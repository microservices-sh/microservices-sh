import type { ImageProvider } from "../ports";
import type { AspectRatio, ProviderEditInput, ProviderGenerateInput, ProviderImageResult } from "../types";
import { ImageProviderError } from "../errors";

export interface GptImageOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  model?: string;
}

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-image-1";

// gpt-image-1 supports a fixed set of sizes; map aspect ratios to the nearest.
function sizeFor(aspectRatio: AspectRatio): string {
  if (aspectRatio === "1:1") return "1024x1024";
  if (aspectRatio === "9:16" || aspectRatio === "3:4") return "1024x1536";
  return "1536x1024"; // 16:9, 4:3
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface GptImageResponse {
  data?: Array<{ b64_json?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

// OpenAI GPT-image adapter. Synchronous JSON response carrying base64 (b64_json).
export function createGptImageProvider(opts: GptImageOptions): ImageProvider {
  const base = opts.baseUrl ?? DEFAULT_BASE;
  const model = opts.model ?? DEFAULT_MODEL;
  const doFetch = opts.fetchImpl ?? fetch;

  function parse(data: GptImageResponse): ProviderImageResult {
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new ImageProviderError("GPT-image returned no image", 502);
    return {
      imageBytes: base64ToBytes(b64),
      mimeType: "image/png",
      usage: { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 },
    };
  }

  return {
    id: "gpt-image",
    async generate(input: ProviderGenerateInput) {
      const prompt = input.negativePrompt ? `${input.prompt}. Avoid: ${input.negativePrompt}` : input.prompt;
      const res = await doFetch(`${base}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, n: 1, size: sizeFor(input.aspectRatio) }),
      });
      if (!res.ok) throw new ImageProviderError("GPT-image generation failed", res.status, await res.text());
      return parse((await res.json()) as GptImageResponse);
    },
    async edit(input: ProviderEditInput) {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", input.prompt);
      form.append("image", new Blob([input.imageBytes as unknown as ArrayBuffer], { type: input.mimeType }), "source.png");
      const res = await doFetch(`${base}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body: form,
      });
      if (!res.ok) throw new ImageProviderError("GPT-image edit failed", res.status, await res.text());
      return parse((await res.json()) as GptImageResponse);
    },
  };
}
