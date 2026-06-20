import { ok, err, enforceScope } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import { fileMediaMeta } from "../meta";
import { createUploadTicket } from "./create-upload-ticket";
import { completeUpload } from "./complete-upload";
import { listFiles } from "./list-files";
import { deleteFile } from "./delete-file";
import type { MediaStore } from "../ports";

// Enforced-authorization wrappers (plans/33, L1). The tenant comes from the
// server-resolved AuthContext, never from caller input: every wrapper forces the
// request's tenantId to ctx.orgId, so a forged tenantId can neither widen a list
// nor reach another tenant's ticket/file (the module's existing row + key guards
// then enforce against the session tenant). Additive strangler — the wrapped
// use-cases are unchanged. See the leak test in file-media.scope.test.ts.

// A non-empty org scope must be present, else refuse (403) rather than run unscoped.
function requireScope(ctx: AuthContext | undefined, deps: { correlationId?: string; now?: () => number }) {
  if (!ctx || typeof ctx.orgId !== "string" || ctx.orgId.length === 0) {
    return err(
      403,
      { code: "file-media.SCOPE_REQUIRED", message: "An authenticated org scope is required." },
      fileMediaMeta(deps)
    );
  }
  return null;
}

function withTenant(input: unknown, orgId: string) {
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return { ...base, tenantId: orgId };
}

export async function createUploadTicketScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof createUploadTicket>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return createUploadTicket(withTenant(input, ctx.orgId), deps);
}

export async function completeUploadScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof completeUpload>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return completeUpload(withTenant(input, ctx.orgId), deps);
}

export async function listFilesScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof listFiles>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listFiles(withTenant(input, ctx.orgId), deps);
}

export async function deleteFileScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof deleteFile>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return deleteFile(withTenant(input, ctx.orgId), deps);
}

// Read one file's metadata, only if it belongs to the active org. A foreign or
// missing id is 404 (no cross-tenant existence disclosure).
export async function getFileScoped(ctx: AuthContext, fileId: string, deps: { mediaStore: MediaStore; correlationId?: string; now?: () => number }) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const meta = fileMediaMeta(deps);
  const file = await deps.mediaStore.getFile(fileId);
  if (!file || !enforceScope(ctx, file.tenantId, { assert: false })) {
    return err(404, { code: "file-media.FILE_NOT_FOUND", message: "File not found." }, meta);
  }
  return ok(200, { file }, meta);
}
