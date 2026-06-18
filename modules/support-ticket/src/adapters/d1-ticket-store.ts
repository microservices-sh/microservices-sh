import type { TicketStore } from "../ports";
import type { Ticket, TicketPriority, TicketStatus } from "../types";

const COLS =
  "id, tenant_id, subject, description, status, priority, requester_email, assignee_id, created_at, updated_at";

function rowToTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    subject: String(row.subject),
    description: String(row.description),
    status: String(row.status) as TicketStatus,
    priority: String(row.priority) as TicketPriority,
    requesterEmail: String(row.requester_email),
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1TicketStore(db: D1Database): TicketStore {
  return {
    async insertTicket(ticket) {
      await db
        .prepare(`INSERT INTO support_tickets (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          ticket.id,
          ticket.tenantId,
          ticket.subject,
          ticket.description,
          ticket.status,
          ticket.priority,
          ticket.requesterEmail,
          ticket.assigneeId,
          ticket.createdAt,
          ticket.updatedAt
        )
        .run();
    },

    async getTicket(id) {
      const row = await db
        .prepare(`SELECT ${COLS} FROM support_tickets WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToTicket(row) : null;
    },

    async listTickets(filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const result = await db
        .prepare(
          `SELECT ${COLS} FROM support_tickets WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`
        )
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToTicket);
    },

    async updateTicket(id, patch) {
      const existing = await this.getTicket(id);
      if (!existing) return null;
      const next: Ticket = {
        ...existing,
        status: patch.status ?? existing.status,
        priority: patch.priority ?? existing.priority,
        assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : existing.assigneeId,
        updatedAt: patch.updatedAt
      };
      await db
        .prepare(
          "UPDATE support_tickets SET status = ?, priority = ?, assignee_id = ?, updated_at = ? WHERE id = ?"
        )
        .bind(next.status, next.priority, next.assigneeId, next.updatedAt, id)
        .run();
      return next;
    }
  };
}
