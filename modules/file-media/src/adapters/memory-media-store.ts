import type { MediaStore } from "../ports";
import type { MediaFile, UploadTicket } from "../types";

export function createMemoryMediaStore(): MediaStore {
  const tickets = new Map<string, UploadTicket>();
  const files = new Map<string, MediaFile>();

  return {
    async insertTicket(ticket) {
      tickets.set(ticket.id, { ...ticket });
    },
    async getTicket(id) {
      const ticket = tickets.get(id);
      return ticket ? { ...ticket } : null;
    },
    async updateTicket(ticket) {
      if (tickets.has(ticket.id)) tickets.set(ticket.id, { ...ticket });
    },
    async listExpiredTickets(nowIso, limit) {
      return [...tickets.values()]
        .filter((ticket) => ticket.status === "pending" && ticket.expiresAt <= nowIso)
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
        .slice(0, limit)
        .map((ticket) => ({ ...ticket }));
    },

    async insertFile(file) {
      files.set(file.id, { ...file });
    },
    async getFile(id) {
      const file = files.get(id);
      return file ? { ...file } : null;
    },
    async updateFile(file) {
      if (files.has(file.id)) files.set(file.id, { ...file });
    },
    async listFiles(filter) {
      return [...files.values()]
        .filter(
          (file) =>
            file.tenantId === filter.tenantId &&
            file.status === (filter.status ?? "active") &&
            (filter.ownerId === undefined ? true : file.ownerId === filter.ownerId)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map((file) => ({ ...file }));
    }
  };
}
