import { ok, err } from "@microservices-sh/connection-contract";
import { beforeTicketCreate } from "../hooks";
import { createTicketInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";
import type { DomainEvent, Ticket } from "../types";

// Create a tenant-scoped support ticket. Defaults status to "open" and priority
// to "normal" (applied by the schema). Emits support-ticket.created.
export async function createTicket(
  input: unknown,
  deps: {
    store: TicketStore;
    now?: () => number;
    id?: () => string;
    correlationId?: string;
  }
) {
  const meta = supportTicketMeta(deps);

  const parsed = createTicketInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_TICKET_INPUT",
        message: "Ticket input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const draft = await beforeTicketCreate(parsed.data);
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const id = deps.id?.() ?? "tkt_" + crypto.randomUUID().slice(0, 16);

  const ticket: Ticket = {
    id,
    tenantId: draft.tenantId,
    subject: draft.subject,
    description: draft.description,
    status: draft.status,
    priority: draft.priority,
    requesterEmail: draft.requesterEmail,
    assigneeId: draft.assigneeId ?? null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await deps.store.insertTicket(ticket);

  const event: DomainEvent = {
    name: "support-ticket.created",
    correlationId: meta.correlationId,
    payload: {
      id: ticket.id,
      tenantId: ticket.tenantId,
      status: ticket.status,
      priority: ticket.priority
    }
  };

  return ok(201, { ticket, event }, meta);
}
