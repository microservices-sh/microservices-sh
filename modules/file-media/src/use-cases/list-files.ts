import { listFilesFilterSchema } from "../schemas";
import type { MediaStore } from "../ports";

// Tenant-scoped listing. tenantId is required by the schema, so a list can never
// be issued without a tenant filter.
export async function listFiles(input: unknown, deps: { mediaStore: MediaStore }) {
  const parsed = listFilesFilterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }
    };
  }
  const files = await deps.mediaStore.listFiles(parsed.data);
  return { ok: true as const, status: 200 as const, data: { files, count: files.length } };
}
