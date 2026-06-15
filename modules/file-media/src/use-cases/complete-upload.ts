import { ok, err } from "@microservices-sh/connection-contract";
import { onFileUploaded } from "../hooks";
import { completeUploadInputSchema } from "../schemas";
import { fileMediaMeta } from "../meta";
import type { MediaStore, ObjectStorage } from "../ports";
import type { MediaFile } from "../types";

// Step 2 of upload: confirm the bytes actually landed (and are within the size
// limit) before recording a MediaFile. Without this check the DB fills with
// records that point at objects that were never uploaded — the orphan/expiry race
// agents miss. Idempotent: completing an already-completed ticket is a no-op.
export async function completeUpload(
  input: unknown,
  deps: { mediaStore: MediaStore; storage: ObjectStorage; now?: () => number; correlationId?: string }
) {
  const meta = fileMediaMeta(deps);

  const parsed = completeUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "file-media.INVALID_COMPLETE_INPUT", message: "Complete-upload input is invalid.", issues: parsed.error.issues }, meta);
  }

  const ticket = await deps.mediaStore.getTicket(parsed.data.ticketId);
  // Tenant check folded into the not-found response so existence never leaks.
  if (!ticket || ticket.tenantId !== parsed.data.tenantId) {
    return err(404, { code: "file-media.TICKET_NOT_FOUND", message: "Upload ticket not found." }, meta);
  }
  if (ticket.status === "completed") {
    return ok(200, { ticketId: ticket.id, status: "already_completed" as const }, meta);
  }

  const nowMs = deps.now?.() ?? Date.now();
  if (ticket.status === "expired" || Date.parse(ticket.expiresAt) <= nowMs) {
    return err(410, { code: "file-media.TICKET_EXPIRED", message: "Upload ticket has expired; request a new one." }, meta);
  }

  const info = await deps.storage.head(ticket.key);
  if (!info) {
    return err(422, { code: "file-media.OBJECT_NOT_FOUND", message: "Upload the bytes to the ticket key before completing." }, meta);
  }
  if (info.size > ticket.maxBytes) {
    // Reject and remove the oversized object so it is not left orphaned.
    await deps.storage.delete(ticket.key);
    return err(413, { code: "file-media.PAYLOAD_TOO_LARGE", message: `Uploaded ${info.size} bytes exceeds the ${ticket.maxBytes}-byte limit.` }, meta);
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

  const event = {
    name: "media.uploaded",
    correlationId: meta.correlationId,
    payload: { id: file.id, tenantId: file.tenantId, key: file.key, bytes: file.bytes, contentType: file.contentType }
  };

  return ok(201, { id: file.id, key: file.key, bytes: file.bytes, contentType: file.contentType, event }, meta);
}
