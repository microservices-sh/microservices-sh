import { ok, err } from "@microservices-sh/connection-contract";
import { afterTicketUpdated } from "../hooks";
import { updateTicketInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";
import type { DomainEvent, Ticket } from "../types";

// Patch a ticket's status, priority, and/or assignee. Emits support-ticket.updated
// always, plus support-ticket.status_changed when the status actually transitions.
export async function updateTicket(
  input: unknown,
  deps: { store: TicketStore; now?: () => number; correlationId?: string }
) {
  const meta = supportTicketMeta(deps);

  const parsed = updateTicketInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_TICKET_INPUT",
        message: "Ticket update input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const existing = await deps.store.getTicket(parsed.data.id);
  if (!existing) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  const previousStatus = existing.status;
  const patch: Partial<Pick<Ticket, "status" | "priority" | "assigneeId">> & { updatedAt: string } = {
    updatedAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
  if (parsed.data.assigneeId !== undefined) patch.assigneeId = parsed.data.assigneeId;

  const ticket = await deps.store.updateTicket(parsed.data.id, patch);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  const statusChanged = ticket.status !== previousStatus;

  const events: DomainEvent[] = [
    {
      name: "support-ticket.updated",
      correlationId: meta.correlationId,
      payload: { id: ticket.id, tenantId: ticket.tenantId, status: ticket.status, priority: ticket.priority }
    }
  ];
  if (statusChanged) {
    events.push({
      name: "support-ticket.status_changed",
      correlationId: meta.correlationId,
      payload: { id: ticket.id, tenantId: ticket.tenantId, from: previousStatus, to: ticket.status }
    });
  }

  await afterTicketUpdated({ ticket, statusChanged });

  return ok(200, { ticket, statusChanged, events }, meta);
}
