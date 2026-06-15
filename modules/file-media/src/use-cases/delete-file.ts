import { ok, err } from "@microservices-sh/connection-contract";
import { keyBelongsToTenant } from "../keys";
import { deleteFileInputSchema } from "../schemas";
import { fileMediaMeta } from "../meta";
import type { MediaStore, ObjectStorage } from "../ports";

// Soft-delete: remove the R2 object but keep the record (status "deleted") for an
// audit trail. Two tenant guards — the row's tenantId and the key prefix — so a
// caller can never delete another tenant's file by guessing an id.
export async function deleteFile(
  input: unknown,
  deps: { mediaStore: MediaStore; storage: ObjectStorage; now?: () => number; correlationId?: string }
) {
  const meta = fileMediaMeta(deps);

  const parsed = deleteFileInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "file-media.INVALID_DELETE_INPUT", message: "Delete input is invalid.", issues: parsed.error.issues }, meta);
  }

  const file = await deps.mediaStore.getFile(parsed.data.fileId);
  if (!file || file.tenantId !== parsed.data.tenantId || !keyBelongsToTenant(file.key, parsed.data.tenantId)) {
    return err(404, { code: "file-media.FILE_NOT_FOUND", message: "File not found." }, meta);
  }
  if (file.status === "deleted") {
    return ok(200, { id: file.id, status: "deleted" as const }, meta);
  }

  try {
    await deps.storage.delete(file.key);
  } catch {
    /* object already gone; soft-delete the record regardless */
  }
  file.status = "deleted";
  file.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.mediaStore.updateFile(file);

  const event = {
    name: "media.deleted",
    correlationId: meta.correlationId,
    payload: { id: file.id, tenantId: file.tenantId, key: file.key }
  };

  return ok(200, { id: file.id, status: "deleted" as const, event }, meta);
}
