import type { Ticket, TicketFilter } from "../types";

export interface TicketStore {
  insertTicket(ticket: Ticket): Promise<void>;
  getTicket(id: string): Promise<Ticket | null>;
  listTickets(filter: TicketFilter): Promise<Ticket[]>;
  // Apply a partial patch (status/priority/assignee/updatedAt) and return the
  // updated row, or null if the id does not exist.
  updateTicket(
    id: string,
    patch: Partial<Pick<Ticket, "status" | "priority" | "assigneeId">> & { updatedAt: string }
  ): Promise<Ticket | null>;
}
