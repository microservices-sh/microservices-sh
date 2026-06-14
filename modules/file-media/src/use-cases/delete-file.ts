import { keyBelongsToTenant } from "../keys";
import { deleteFileInputSchema } from "../schemas";
import type { MediaStore, ObjectStorage } from "../ports";

// Soft-delete: remove the R2 object but keep the record (status "deleted") for an
// audit trail. Two tenant guards — the row's tenantId and the key prefix — so a
// caller can never delete another tenant's file by guessing an id.
export async function deleteFile(
  input: unknown,
  deps: { mediaStore: MediaStore; storage: ObjectStorage; now?: () => number }
) {
  const parsed = deleteFileInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_DELETE_INPUT", message: "Delete input is invalid.", issues: parsed.error.issues }
    };
  }

  const file = await deps.mediaStore.getFile(parsed.data.fileId);
  if (!file || file.tenantId !== parsed.data.tenantId || !keyBelongsToTenant(file.key, parsed.data.tenantId)) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "FILE_NOT_FOUND", message: "File not found." } };
  }
  if (file.status === "deleted") {
    return { ok: true as const, status: 200 as const, data: { id: file.id, status: "deleted" } };
  }

  try {
    await deps.storage.delete(file.key);
  } catch {
    /* object already gone; soft-delete the record regardless */
  }
  file.status = "deleted";
  file.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.mediaStore.updateFile(file);

  return { ok: true as const, status: 200 as const, data: { id: file.id, status: "deleted" } };
}
