import { ok, err } from "@microservices-sh/connection-contract";
import { addTicketCommentInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";
import type { DomainEvent, TicketComment } from "../types";

export async function addTicketComment(
  input: unknown,
  deps: {
    store: TicketStore;
    now?: () => number;
    id?: () => string;
    correlationId?: string;
  }
) {
  const meta = supportTicketMeta(deps);
  const parsed = addTicketCommentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_COMMENT_INPUT",
        message: "Ticket comment input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const ticket = await deps.store.getTicket(parsed.data.ticketId);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const comment: TicketComment = {
    id: deps.id?.() ?? "tcmt_" + crypto.randomUUID().slice(0, 16),
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    authorType: parsed.data.authorType,
    authorId: parsed.data.authorId ?? null,
    authorName: parsed.data.authorName ?? null,
    authorEmail: parsed.data.authorEmail?.toLowerCase() ?? null,
    content: parsed.data.content.trim(),
    isInternal: parsed.data.isInternal,
    createdAt: nowIso
  };

  await deps.store.insertTicketComment(comment);
  await deps.store.updateTicket(ticket.id, { updatedAt: nowIso });

  const event: DomainEvent = {
    name: "support-ticket.comment.created",
    correlationId: meta.correlationId,
    payload: {
      id: comment.id,
      tenantId: comment.tenantId,
      ticketId: comment.ticketId,
      authorType: comment.authorType,
      isInternal: comment.isInternal
    }
  };

  return ok(201, { comment, event }, meta);
}
