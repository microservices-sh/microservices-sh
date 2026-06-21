import type { TicketStore } from "../ports";
import type { Ticket, TicketAttachment, TicketComment, TicketShareToken } from "../types";

export function createMemoryTicketStore(): TicketStore {
  const tickets = new Map<string, Ticket>();
  const sequences = new Map<string, number>();
  const comments = new Map<string, TicketComment>();
  const attachments = new Map<string, TicketAttachment>();
  const shareTokens = new Map<string, TicketShareToken>();

  return {
    async nextTicketNumber(tenantId) {
      const next = (sequences.get(tenantId) ?? 0) + 1;
      sequences.set(tenantId, next);
      return next;
    },

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
    },

    async insertTicketComment(comment) {
      comments.set(comment.id, { ...comment });
    },

    async listTicketComments(ticketId, includeInternal = false) {
      return [...comments.values()]
        .filter((comment) => comment.ticketId === ticketId && (includeInternal || !comment.isInternal))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((comment) => ({ ...comment }));
    },

    async insertTicketAttachment(attachment) {
      attachments.set(attachment.id, { ...attachment });
    },

    async listTicketAttachments(ticketId) {
      return [...attachments.values()]
        .filter((attachment) => attachment.ticketId === ticketId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((attachment) => ({ ...attachment }));
    },

    async insertTicketShareToken(shareToken) {
      shareTokens.set(shareToken.id, { ...shareToken });
    },

    async getTicketShareToken(id) {
      const shareToken = shareTokens.get(id);
      return shareToken ? { ...shareToken } : null;
    },

    async getTicketShareTokenByToken(token) {
      const shareToken = [...shareTokens.values()].find((candidate) => candidate.token === token);
      return shareToken ? { ...shareToken } : null;
    },

    async listTicketShareTokens(ticketId) {
      return [...shareTokens.values()]
        .filter((shareToken) => shareToken.ticketId === ticketId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((shareToken) => ({ ...shareToken }));
    },

    async touchTicketShareToken(token, lastAccessedAt) {
      for (const [id, shareToken] of shareTokens.entries()) {
        if (shareToken.token === token) {
          shareTokens.set(id, { ...shareToken, lastAccessedAt });
          return;
        }
      }
    },

    async revokeTicketShareToken(id) {
      const shareToken = shareTokens.get(id);
      if (!shareToken) return null;
      const revoked = { ...shareToken, isActive: false };
      shareTokens.set(id, revoked);
      return { ...revoked };
    }
  };
}
