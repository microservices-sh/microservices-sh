import { ok, err } from "@microservices-sh/connection-contract";
import { attachTicketFileInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";
import type { DomainEvent, TicketAttachment } from "../types";

export async function attachTicketFile(
  input: unknown,
  deps: {
    store: TicketStore;
    now?: () => number;
    id?: () => string;
    correlationId?: string;
  }
) {
  const meta = supportTicketMeta(deps);
  const parsed = attachTicketFileInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_ATTACHMENT_INPUT",
        message: "Ticket attachment input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const ticket = await deps.store.getTicket(parsed.data.ticketId);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  if (parsed.data.storageKey.includes("..")) {
    return err(
      400,
      { code: "support-ticket.INVALID_ATTACHMENT_INPUT", message: "Attachment storage key cannot contain parent traversal." },
      meta
    );
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const attachment: TicketAttachment = {
    id: deps.id?.() ?? "tatt_" + crypto.randomUUID().slice(0, 16),
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.sizeBytes,
    storageKey: parsed.data.storageKey,
    createdAt: nowIso
  };

  await deps.store.insertTicketAttachment(attachment);
  await deps.store.updateTicket(ticket.id, { updatedAt: nowIso });

  const event: DomainEvent = {
    name: "support-ticket.attachment.attached",
    correlationId: meta.correlationId,
    payload: {
      id: attachment.id,
      tenantId: attachment.tenantId,
      ticketId: attachment.ticketId,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes
    }
  };

  return ok(201, { attachment, event }, meta);
}
