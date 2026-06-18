import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { allowContentType as defaultAllow, beforeUpload } from "../hooks";
import { buildObjectKey } from "../keys";
import { createUploadTicketInputSchema } from "../schemas";
import { fileMediaMeta } from "../meta";
import type { MediaStore } from "../ports";
import type { UploadTicket } from "../types";

// Step 1 of upload: validate the request and reserve a tenant-scoped key with a
// time-boxed ticket. Content-type allowlisting and the size ceiling are enforced
// here, and the key is tenant-prefixed at the source — the two things agents
// skip that lead to malicious uploads and cross-tenant key collisions.
//
// Two layers of customization run before the key is reserved:
//   1. the local config seam `beforeUpload` (per-app override / pass-through)
//   2. the cross-module `beforeUpload` hook chain (Plan 25 §5), injected by the
//      composed app via deps.beforeUploadHooks — filters may mutate the input,
//      guards may veto.
export async function createUploadTicket(
  input: unknown,
  deps: {
    mediaStore: MediaStore;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
    allow?: (contentType: string) => boolean;
    correlationId?: string;
    beforeUploadHooks?: ResolvedHook[];
  }
) {
  const meta = fileMediaMeta(deps);

  const parsed = createUploadTicketInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "file-media.INVALID_UPLOAD_INPUT", message: "Upload input is invalid.", issues: parsed.error.issues }, meta);
  }

  const configData = await beforeUpload(parsed.data);
  if (!configData) {
    return ok(200, { ticketId: null, skipped: true }, meta);
  }

  const hookedResult = await runHooks(
    "beforeUpload",
    configData,
    { correlationId: meta.correlationId },
    deps.beforeUploadHooks ?? []
  );
  if (!hookedResult.ok) {
    return err(hookedResult.status, hookedResult.error, meta);
  }
  const hooked = hookedResult.value as typeof configData;

  const cfg = { ...defaultConfig, ...deps.config };
  const allow = deps.allow ?? defaultAllow;
  if (!allow(hooked.contentType)) {
    return err(415, { code: "file-media.UNSUPPORTED_MEDIA_TYPE", message: `Content type ${hooked.contentType} is not allowed.` }, meta);
  }
  if (hooked.declaredBytes && hooked.declaredBytes > cfg.maxBytes) {
    return err(413, { code: "file-media.PAYLOAD_TOO_LARGE", message: `Declared size exceeds the ${cfg.maxBytes}-byte limit.` }, meta);
  }

  const nowMs = deps.now?.() ?? Date.now();
  const id = "upl_" + crypto.randomUUID().slice(0, 16);
  const key = buildObjectKey(hooked.tenantId, id, hooked.originalName);

  const ticket: UploadTicket = {
    id,
    tenantId: hooked.tenantId,
    ownerId: hooked.ownerId ?? null,
    key,
    contentType: hooked.contentType,
    originalName: hooked.originalName,
    maxBytes: cfg.maxBytes,
    status: "pending",
    expiresAt: new Date(nowMs + cfg.ticketTtlMs).toISOString(),
    createdAt: new Date(nowMs).toISOString()
  };
  await deps.mediaStore.insertTicket(ticket);

  const event = {
    name: "media.upload_requested",
    correlationId: meta.correlationId,
    payload: { ticketId: id, tenantId: ticket.tenantId, ownerId: ticket.ownerId, key, contentType: ticket.contentType }
  };

  return ok(201, { ticketId: id, key, ownerId: ticket.ownerId, maxBytes: ticket.maxBytes, contentType: ticket.contentType, expiresAt: ticket.expiresAt, event }, meta);
}
