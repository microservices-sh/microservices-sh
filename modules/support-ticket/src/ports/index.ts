import type {
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketFilter,
  TicketShareToken
} from "../types";

export interface TicketStore {
  nextTicketNumber(tenantId: string): Promise<number>;
  insertTicket(ticket: Ticket): Promise<void>;
  getTicket(id: string): Promise<Ticket | null>;
  listTickets(filter: TicketFilter): Promise<Ticket[]>;
  // Apply a partial patch (status/priority/assignee/updatedAt) and return the
  // updated row, or null if the id does not exist.
  updateTicket(
    id: string,
    patch: Partial<Pick<Ticket, "status" | "priority" | "assigneeId">> & { updatedAt: string }
  ): Promise<Ticket | null>;
  insertTicketComment(comment: TicketComment): Promise<void>;
  listTicketComments(ticketId: string, includeInternal?: boolean): Promise<TicketComment[]>;
  insertTicketAttachment(attachment: TicketAttachment): Promise<void>;
  listTicketAttachments(ticketId: string): Promise<TicketAttachment[]>;
  insertTicketShareToken(shareToken: TicketShareToken): Promise<void>;
  getTicketShareToken(id: string): Promise<TicketShareToken | null>;
  getTicketShareTokenByToken(token: string): Promise<TicketShareToken | null>;
  listTicketShareTokens(ticketId: string): Promise<TicketShareToken[]>;
  touchTicketShareToken(token: string, lastAccessedAt: string): Promise<void>;
  revokeTicketShareToken(id: string): Promise<TicketShareToken | null>;
}
