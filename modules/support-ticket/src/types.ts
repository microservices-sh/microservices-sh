// A support ticket moves through an open -> pending -> resolved -> closed
// lifecycle. Status and priority are closed enums; assigneeId is the agent the
// ticket is routed to (null while unassigned). Tenant-scoped like customer/invoice.
export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface Ticket {
  id: string;
  tenantId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterEmail: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilter {
  tenantId: string;
  status?: TicketStatus;
  limit?: number;
}

export interface Actor {
  id: string;
  email?: string;
  isAdmin?: boolean;
}

// A domain event the module emits. correlationId is threaded from the use-case
// meta so downstream consumers can stitch the causal chain. See Plan 25 section 4.
export interface DomainEvent {
  name: string;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}
