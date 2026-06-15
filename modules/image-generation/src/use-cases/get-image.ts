import { ok, err } from "@microservices-sh/connection-contract";
import { getImageInputSchema } from "../schemas";
import { imageGenerationMeta } from "../meta";
import type { ImageStore } from "../ports";

export interface GetImageDeps {
  store: ImageStore;
  correlationId?: string;
}

// Fetch a single image, scoped to the caller's tenant. Cross-tenant access reads
// as not-found rather than forbidden, so ids cannot be probed across tenants.
export async function getImage(input: unknown, deps: GetImageDeps) {
  const meta = imageGenerationMeta(deps);

  const parsed = getImageInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "image-generation.INVALID_GET_INPUT", message: "Get input is invalid.", issues: parsed.error.issues }, meta);
  }

  const image = await deps.store.get(parsed.data.imageId);
  if (!image || image.tenantId !== parsed.data.tenantId) {
    return err(404, { code: "image-generation.IMAGE_NOT_FOUND", message: "Image not found." }, meta);
  }

  return ok(200, { image }, meta);
}
