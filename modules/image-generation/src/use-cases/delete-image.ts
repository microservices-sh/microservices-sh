import { ok, err } from "@microservices-sh/connection-contract";
import { deleteImageInputSchema } from "../schemas";
import { keyBelongsToTenant } from "../keys";
import { imageGenerationMeta } from "../meta";
import type { ImageStore, ObjectStorage } from "../ports";

export interface DeleteImageDeps {
  store: ImageStore;
  storage: ObjectStorage;
  now?: () => number;
  correlationId?: string;
}

// Delete an image: verify ownership (record tenant + key prefix), remove the R2
// object, then soft-delete the record so the row remains for audit.
export async function deleteImage(input: unknown, deps: DeleteImageDeps) {
  const meta = imageGenerationMeta(deps);

  const parsed = deleteImageInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "image-generation.INVALID_DELETE_INPUT", message: "Delete input is invalid.", issues: parsed.error.issues }, meta);
  }

  const image = await deps.store.get(parsed.data.imageId);
  if (!image || image.tenantId !== parsed.data.tenantId || !keyBelongsToTenant(image.key, parsed.data.tenantId)) {
    return err(404, { code: "image-generation.IMAGE_NOT_FOUND", message: "Image not found." }, meta);
  }

  await deps.storage.delete(image.key);

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.update({ ...image, status: "deleted", updatedAt: nowIso });

  const event = {
    name: "image.deleted",
    correlationId: meta.correlationId,
    payload: { imageId: image.id, tenantId: image.tenantId, key: image.key },
  };

  return ok(200, { id: image.id, deleted: true, event }, meta);
}
