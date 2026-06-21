import { ok, err } from "@microservices-sh/connection-contract";
import { listTicketThreadInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";

export async function listTicketThread(
  input: unknown,
  deps: { store: TicketStore; correlationId?: string; now?: () => number }
) {
  const meta = supportTicketMeta(deps);
  const parsed = listTicketThreadInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_THREAD_INPUT",
        message: "Ticket thread input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const ticket = await deps.store.getTicket(parsed.data.ticketId);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  const [comments, attachments] = await Promise.all([
    deps.store.listTicketComments(ticket.id, parsed.data.includeInternal),
    deps.store.listTicketAttachments(ticket.id)
  ]);

  return ok(200, { ticket, comments, attachments }, meta);
}
