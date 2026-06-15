import { ok, err } from "@microservices-sh/connection-contract";
import { listImagesFilterSchema } from "../schemas";
import { imageGenerationMeta } from "../meta";
import type { ImageStore } from "../ports";

export interface ListImagesDeps {
  store: ImageStore;
  correlationId?: string;
}

// Tenant-scoped listing. tenantId is required by the schema, so a list can never
// be issued without a tenant filter.
export async function listImages(input: unknown, deps: ListImagesDeps) {
  const meta = imageGenerationMeta(deps);

  const parsed = listImagesFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "image-generation.INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }, meta);
  }

  const images = await deps.store.list(parsed.data);
  return ok(200, { images, count: images.length }, meta);
}
