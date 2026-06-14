import { onFileUploaded } from "../hooks";
import { completeUploadInputSchema } from "../schemas";
import type { MediaStore, ObjectStorage } from "../ports";
import type { MediaFile } from "../types";

// Step 2 of upload: confirm the bytes actually landed (and are within the size
// limit) before recording a MediaFile. Without this check the DB fills with
// records that point at objects that were never uploaded — the orphan/expiry race
// agents miss. Idempotent: completing an already-completed ticket is a no-op.
export async function completeUpload(
  input: unknown,
  deps: { mediaStore: MediaStore; storage: ObjectStorage; now?: () => number }
) {
  const parsed = completeUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_COMPLETE_INPUT", message: "Complete-upload input is invalid.", issues: parsed.error.issues }
    };
  }

  const ticket = await deps.mediaStore.getTicket(parsed.data.ticketId);
  // Tenant check folded into the not-found response so existence never leaks.
  if (!ticket || ticket.tenantId !== parsed.data.tenantId) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "TICKET_NOT_FOUND", message: "Upload ticket not found." } };
  }
  if (ticket.status === "completed") {
    return { ok: true as const, status: 200 as const, data: { ticketId: ticket.id, status: "already_completed" } };
  }

  const nowMs = deps.now?.() ?? Date.now();
  if (ticket.status === "expired" || Date.parse(ticket.expiresAt) <= nowMs) {
    return { ok: false as const, status: 410 as const, data: null, error: { code: "TICKET_EXPIRED", message: "Upload ticket has expired; request a new one." } };
  }

  const info = await deps.storage.head(ticket.key);
  if (!info) {
    return { ok: false as const, status: 422 as const, data: null, error: { code: "OBJECT_NOT_FOUND", message: "Upload the bytes to the ticket key before completing." } };
  }
  if (info.size > ticket.maxBytes) {
    // Reject and remove the oversized object so it is not left orphaned.
    await deps.storage.delete(ticket.key);
    return { ok: false as const, status: 413 as const, data: null, error: { code: "PAYLOAD_TOO_LARGE", message: `Uploaded ${info.size} bytes exceeds the ${ticket.maxBytes}-byte limit.` } };
  }

  const nowIso = new Date(nowMs).toISOString();
  const file: MediaFile = {
    id: "file_" + crypto.randomUUID().slice(0, 16),
    tenantId: ticket.tenantId,
    key: ticket.key,
    contentType: info.contentType ?? ticket.contentType,
    bytes: info.size,
    originalName: ticket.originalName,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso
  };
  await deps.mediaStore.insertFile(file);

  ticket.status = "completed";
  await deps.mediaStore.updateTicket(ticket);

  await onFileUploaded(file);

  return {
    ok: true as const,
    status: 201 as const,
    data: { id: file.id, key: file.key, bytes: file.bytes, contentType: file.contentType }
  };
}
