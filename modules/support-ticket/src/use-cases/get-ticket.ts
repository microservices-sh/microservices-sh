import { ok, err } from "@microservices-sh/connection-contract";
import { ticketIdSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";

// Fetch a single ticket by id. 404 when absent.
export async function getTicket(
  input: unknown,
  deps: { store: TicketStore; correlationId?: string; now?: () => number }
) {
  const meta = supportTicketMeta(deps);

  const parsed = ticketIdSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_TICKET_INPUT",
        message: "Ticket lookup input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const ticket = await deps.store.getTicket(parsed.data.id);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  return ok(200, { ticket }, meta);
}
