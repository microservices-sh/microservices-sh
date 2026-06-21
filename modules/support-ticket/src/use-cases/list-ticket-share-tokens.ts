import { ok, err } from "@microservices-sh/connection-contract";
import { listTicketShareTokensInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";

export async function listTicketShareTokens(
  input: unknown,
  deps: { store: TicketStore; correlationId?: string; now?: () => number }
) {
  const meta = supportTicketMeta(deps);
  const parsed = listTicketShareTokensInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_SHARE_TOKEN_INPUT",
        message: "Ticket share-token input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const ticket = await deps.store.getTicket(parsed.data.ticketId);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  const shareTokens = await deps.store.listTicketShareTokens(ticket.id);
  return ok(200, { ticket, shareTokens }, meta);
}
