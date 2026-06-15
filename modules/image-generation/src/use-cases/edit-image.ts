import { ok, err } from "@microservices-sh/connection-contract";
import { editImageInputSchema } from "../schemas";
import { defaultConfig } from "../config";
import { buildImageKey } from "../keys";
import { imageGenerationMeta } from "../meta";
import { editWithFallback } from "../service";
import { ImageProviderError } from "../errors";
import type { ImageStore, ObjectStorage } from "../ports";
import type { ProviderRegistry } from "../service";
import type { ImageGenerationConfig } from "../config";
import type { GeneratedImage } from "../types";

export interface EditImageDeps {
  providers: ProviderRegistry;
  store: ImageStore;
  storage: ObjectStorage;
  config?: Partial<ImageGenerationConfig>;
  now?: () => number;
  correlationId?: string;
}

// Edit an existing image into a new record: load the (tenant-owned) source bytes,
// run the provider edit (with fallback), store the result as a fresh gallery row.
export async function editImage(input: unknown, deps: EditImageDeps) {
  const meta = imageGenerationMeta(deps);

  const parsed = editImageInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "image-generation.INVALID_EDIT_INPUT", message: "Edit input is invalid.", issues: parsed.error.issues }, meta);
  }

  const source = await deps.store.get(parsed.data.sourceImageId);
  if (!source || source.tenantId !== parsed.data.tenantId) {
    return err(404, { code: "image-generation.SOURCE_NOT_FOUND", message: "Source image not found." }, meta);
  }

  const obj = await deps.storage.get(source.key);
  if (!obj) {
    return err(404, { code: "image-generation.SOURCE_BYTES_MISSING", message: "Source image bytes are missing." }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };

  let result;
  try {
    result = await editWithFallback(
      deps.providers,
      cfg,
      { prompt: parsed.data.prompt, imageBytes: new Uint8Array(obj.body), mimeType: obj.contentType ?? source.mimeType },
      parsed.data.provider,
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
  const key = buildImageKey(parsed.data.tenantId, id, result.mimeType);

  await deps.storage.put(key, result.imageBytes, { contentType: result.mimeType });

  const image: GeneratedImage = {
    id,
    tenantId: parsed.data.tenantId,
    prompt: parsed.data.prompt,
    negativePrompt: null,
    provider: result.provider,
    aspectRatio: source.aspectRatio,
    key,
    mimeType: result.mimeType,
    bytes: result.imageBytes.byteLength,
    tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
    source: parsed.data.source,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await deps.store.insert(image);

  const event = {
    name: "image.edited",
    correlationId: meta.correlationId,
    payload: { imageId: id, sourceImageId: source.id, tenantId: image.tenantId, provider: image.provider, key },
  };

  return ok(201, { id, key, provider: image.provider, sourceImageId: source.id, event }, meta);
}
