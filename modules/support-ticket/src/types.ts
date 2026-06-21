// A support ticket moves through an open -> pending -> resolved -> closed
// lifecycle. Status and priority are closed enums; assigneeId is the agent the
// ticket is routed to (null while unassigned). Tenant-scoped like customer/invoice.
export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface Ticket {
  id: string;
  tenantId: string;
  ticketNumber: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterEmail: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TicketCommentAuthorType = "customer" | "agent" | "system";

export interface TicketComment {
  id: string;
  tenantId: string;
  ticketId: string;
  authorType: TicketCommentAuthorType;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  tenantId: string;
  ticketId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
}

export interface TicketShareToken {
  id: string;
  tenantId: string;
  ticketId: string;
  token: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  lastAccessedAt: string | null;
}

export interface TicketPublicSnapshot {
  ticket: Ticket;
  shareToken: TicketShareToken;
  comments: TicketComment[];
  attachments: TicketAttachment[];
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
