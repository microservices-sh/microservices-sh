import type { ImageProvider } from "../ports";
import type { ProviderEditInput, ProviderGenerateInput, ProviderImageResult } from "../types";
import { ImageProviderError } from "../errors";

export interface GeminiOptions {
  // Full generateContent endpoint URL (host builds the Vertex/AI-Gateway URL).
  endpoint: string;
  authHeader?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

// Google Gemini image adapter (responseModalities: ["IMAGE"]). One synchronous
// generateContent call returns inline image data.
export function createGeminiProvider(opts: GeminiOptions): ImageProvider {
  const doFetch = opts.fetchImpl ?? fetch;

  async function call(parts: unknown[], extraGenConfig: Record<string, unknown>): Promise<ProviderImageResult> {
    const res = await doFetch(opts.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(opts.authHeader ?? {}) },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"], ...extraGenConfig },
      }),
    });
    if (!res.ok) throw new ImageProviderError("Gemini generation failed", res.status, await res.text());

    const data = (await res.json()) as GeminiResponse;
    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason === "SAFETY") {
      throw new ImageProviderError("Gemini blocked the request", 400);
    }
    const imagePart = candidate.content?.parts?.find((p) => p.inlineData);
    if (!imagePart?.inlineData) throw new ImageProviderError("Gemini returned no image", 502);

    return {
      imageBytes: base64ToBytes(imagePart.inlineData.data),
      mimeType: imagePart.inlineData.mimeType || "image/png",
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  return {
    id: "gemini",
    async generate(input: ProviderGenerateInput) {
      const text = input.negativePrompt ? `${input.prompt}\n\nNegative prompt: ${input.negativePrompt}` : input.prompt;
      return call([{ text }], { imageConfig: { aspectRatio: input.aspectRatio } });
    },
    async edit(input: ProviderEditInput) {
      return call(
        [{ text: input.prompt }, { inlineData: { mimeType: input.mimeType, data: bytesToBase64(input.imageBytes) } }],
        {},
      );
    },
  };
}
