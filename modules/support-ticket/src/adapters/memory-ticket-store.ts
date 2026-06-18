import type { TicketStore } from "../ports";
import type { Ticket } from "../types";

export function createMemoryTicketStore(): TicketStore {
  const tickets = new Map<string, Ticket>();

  return {
    async insertTicket(ticket) {
      tickets.set(ticket.id, { ...ticket });
    },

    async getTicket(id) {
      const ticket = tickets.get(id);
      return ticket ? { ...ticket } : null;
    },

    async listTickets(filter) {
      return [...tickets.values()]
        .filter(
          (ticket) =>
            ticket.tenantId === filter.tenantId && (!filter.status || ticket.status === filter.status)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map((ticket) => ({ ...ticket }));
    },

    async updateTicket(id, patch) {
      const existing = tickets.get(id);
      if (!existing) return null;
      const updated: Ticket = {
        ...existing,
        status: patch.status ?? existing.status,
        priority: patch.priority ?? existing.priority,
        assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : existing.assigneeId,
        updatedAt: patch.updatedAt
      };
      tickets.set(id, updated);
      return { ...updated };
    }
  };
}
