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

// A grounded-answer source (cite-or-refuse). The app injects an implementation
// backed by the research module's retriever + synthesizer, so support replies are
// drafted ONLY from cited knowledge — an ungrounded question yields an empty
// answer / no citations, which the draft use-case turns into a refusal rather
// than a hallucinated reply to a customer.
export interface GroundedAnswerer {
  answer(question: string): Promise<{ answer: string; citedSourceFiles: string[] }>;
}
