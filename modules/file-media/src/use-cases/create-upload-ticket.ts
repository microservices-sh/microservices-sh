import { defaultConfig } from "../config";
import { allowContentType as defaultAllow, beforeUpload } from "../hooks";
import { buildObjectKey } from "../keys";
import { createUploadTicketInputSchema } from "../schemas";
import type { MediaStore } from "../ports";
import type { UploadTicket } from "../types";

// Step 1 of upload: validate the request and reserve a tenant-scoped key with a
// time-boxed ticket. Content-type allowlisting and the size ceiling are enforced
// here, and the key is tenant-prefixed at the source — the two things agents
// skip that lead to malicious uploads and cross-tenant key collisions.
export async function createUploadTicket(
  input: unknown,
  deps: {
    mediaStore: MediaStore;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
    allow?: (contentType: string) => boolean;
  }
) {
  const parsed = createUploadTicketInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_UPLOAD_INPUT", message: "Upload input is invalid.", issues: parsed.error.issues }
    };
  }

  const hooked = await beforeUpload(parsed.data);
  if (!hooked) {
    return { ok: true as const, status: 200 as const, data: { ticketId: null, skipped: true } };
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const allow = deps.allow ?? defaultAllow;
  if (!allow(hooked.contentType)) {
    return {
      ok: false as const,
      status: 415 as const,
      data: null,
      error: { code: "UNSUPPORTED_MEDIA_TYPE", message: `Content type ${hooked.contentType} is not allowed.` }
    };
  }
  if (hooked.declaredBytes && hooked.declaredBytes > cfg.maxBytes) {
    return {
      ok: false as const,
      status: 413 as const,
      data: null,
      error: { code: "PAYLOAD_TOO_LARGE", message: `Declared size exceeds the ${cfg.maxBytes}-byte limit.` }
    };
  }

  const nowMs = deps.now?.() ?? Date.now();
  const id = "upl_" + crypto.randomUUID().slice(0, 16);
  const key = buildObjectKey(hooked.tenantId, id, hooked.originalName);

  const ticket: UploadTicket = {
    id,
    tenantId: hooked.tenantId,
    key,
    contentType: hooked.contentType,
    originalName: hooked.originalName,
    maxBytes: cfg.maxBytes,
    status: "pending",
    expiresAt: new Date(nowMs + cfg.ticketTtlMs).toISOString(),
    createdAt: new Date(nowMs).toISOString()
  };
  await deps.mediaStore.insertTicket(ticket);

  return {
    ok: true as const,
    status: 201 as const,
    data: { ticketId: id, key, maxBytes: ticket.maxBytes, contentType: ticket.contentType, expiresAt: ticket.expiresAt }
  };
}
