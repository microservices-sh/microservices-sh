import { ok, err } from "@microservices-sh/connection-contract";
import { listTicketsFilterSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";

// Tenant-scoped listing, optionally filtered by status.
export async function listTickets(
  input: unknown,
  deps: { store: TicketStore; correlationId?: string; now?: () => number }
) {
  const meta = supportTicketMeta(deps);

  const parsed = listTicketsFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_FILTER",
        message: "List filter is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const tickets = await deps.store.listTickets(parsed.data);
  return ok(200, { tickets, count: tickets.length }, meta);
}
