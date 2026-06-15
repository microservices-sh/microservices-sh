import { ok, err } from "@microservices-sh/connection-contract";
import { listFilesFilterSchema } from "../schemas";
import { fileMediaMeta } from "../meta";
import type { MediaStore } from "../ports";

// Tenant-scoped listing. tenantId is required by the schema, so a list can never
// be issued without a tenant filter.
export async function listFiles(
  input: unknown,
  deps: { mediaStore: MediaStore; correlationId?: string }
) {
  const meta = fileMediaMeta(deps);

  const parsed = listFilesFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "file-media.INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }, meta);
  }
  const files = await deps.mediaStore.listFiles(parsed.data);
  return ok(200, { files, count: files.length }, meta);
}
