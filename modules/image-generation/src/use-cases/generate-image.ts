import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { generateImageInputSchema } from "../schemas";
import { defaultConfig } from "../config";
import { beforeGenerate } from "../hooks";
import { buildImageKey } from "../keys";
import { imageGenerationMeta } from "../meta";
import { generateWithFallback } from "../service";
import { ImageProviderError } from "../errors";
import type { ImageStore, ObjectStorage } from "../ports";
import type { ProviderRegistry } from "../service";
import type { ImageGenerationConfig } from "../config";
import type { GeneratedImage } from "../types";

export interface GenerateImageDeps {
  providers: ProviderRegistry;
  store: ImageStore;
  storage: ObjectStorage;
  config?: Partial<ImageGenerationConfig>;
  now?: () => number;
  correlationId?: string;
  beforeGenerateHooks?: ResolvedHook[];
}

// Generate an image: validate, run the beforeGenerate customization seam + the
// cross-module hook chain, pick a provider (with fallback), store the bytes under
// a tenant-scoped key, and persist a gallery record.
export async function generateImage(input: unknown, deps: GenerateImageDeps) {
  const meta = imageGenerationMeta(deps);

  const parsed = generateImageInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "image-generation.INVALID_GENERATE_INPUT", message: "Generation input is invalid.", issues: parsed.error.issues }, meta);
  }

  const configData = await beforeGenerate(parsed.data);
  if (!configData) {
    return ok(200, { id: null, skipped: true }, meta);
  }

  const hookedResult = await runHooks("beforeGenerate", configData, { correlationId: meta.correlationId }, deps.beforeGenerateHooks ?? []);
  if (!hookedResult.ok) {
    return err(hookedResult.status, hookedResult.error, meta);
  }
  const hooked = hookedResult.value as typeof configData;

  const cfg = { ...defaultConfig, ...deps.config };

  let result;
  try {
    result = await generateWithFallback(
      deps.providers,
      cfg,
      { prompt: hooked.prompt, aspectRatio: hooked.aspectRatio, negativePrompt: hooked.negativePrompt },
      hooked.provider,
    );
  } catch (e) {
    if (e instanceof ImageProviderError) {
      return err(e.status, { code: "image-generation.PROVIDER_ERROR", message: e.detail ? `${e.message}: ${e.detail}` : e.message }, meta);
    }
    throw e;
  }

  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const id = "img_" + crypto.randomUUID().slice(0, 16);
  const key = buildImageKey(hooked.tenantId, id, result.mimeType);

  await deps.storage.put(key, result.imageBytes, { contentType: result.mimeType });

  const image: GeneratedImage = {
    id,
    tenantId: hooked.tenantId,
    prompt: hooked.prompt,
    negativePrompt: hooked.negativePrompt ?? null,
    provider: result.provider,
    aspectRatio: hooked.aspectRatio,
    key,
    mimeType: result.mimeType,
    bytes: result.imageBytes.byteLength,
    tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
    source: hooked.source,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await deps.store.insert(image);

  const event = {
    name: "image.generated",
    correlationId: meta.correlationId,
    payload: { imageId: id, tenantId: image.tenantId, provider: image.provider, key },
  };

  return ok(201, { id, key, provider: image.provider, mimeType: image.mimeType, bytes: image.bytes, tokensUsed: image.tokensUsed, event }, meta);
}
