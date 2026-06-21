import type { TicketStore } from "../ports";
import type {
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketCommentAuthorType,
  TicketPriority,
  TicketShareToken,
  TicketStatus
} from "../types";

const COLS =
  "id, tenant_id, ticket_number, subject, description, status, priority, requester_email, assignee_id, created_at, updated_at";
const COMMENT_COLS =
  "id, tenant_id, ticket_id, author_type, author_id, author_name, author_email, content, is_internal, created_at";
const ATTACHMENT_COLS =
  "id, tenant_id, ticket_id, filename, content_type, size_bytes, storage_key, created_at";
const SHARE_TOKEN_COLS =
  "id, tenant_id, ticket_id, token, is_active, expires_at, created_at, last_accessed_at";

function bool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function rowToTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ticketNumber: Number(row.ticket_number ?? 0),
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

function rowToComment(row: Record<string, unknown>): TicketComment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ticketId: String(row.ticket_id),
    authorType: String(row.author_type) as TicketCommentAuthorType,
    authorId: nullable(row.author_id),
    authorName: nullable(row.author_name),
    authorEmail: nullable(row.author_email),
    content: String(row.content),
    isInternal: bool(row.is_internal),
    createdAt: String(row.created_at)
  };
}

function rowToAttachment(row: Record<string, unknown>): TicketAttachment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ticketId: String(row.ticket_id),
    filename: String(row.filename),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    storageKey: String(row.storage_key),
    createdAt: String(row.created_at)
  };
}

function rowToShareToken(row: Record<string, unknown>): TicketShareToken {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ticketId: String(row.ticket_id),
    token: String(row.token),
    isActive: bool(row.is_active),
    expiresAt: nullable(row.expires_at),
    createdAt: String(row.created_at),
    lastAccessedAt: nullable(row.last_accessed_at)
  };
}

export function createD1TicketStore(db: D1Database): TicketStore {
  return {
    async nextTicketNumber(tenantId) {
      const row = await db
        .prepare(
          `INSERT INTO support_ticket_sequences (tenant_id, last_ticket_number)
           VALUES (?, 1)
           ON CONFLICT(tenant_id) DO UPDATE SET last_ticket_number = last_ticket_number + 1
           RETURNING last_ticket_number`
        )
        .bind(tenantId)
        .first<Record<string, unknown>>();
      return Number(row?.last_ticket_number ?? 1);
    },

    async insertTicket(ticket) {
      await db
        .prepare(`INSERT INTO support_tickets (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          ticket.id,
          ticket.tenantId,
          ticket.ticketNumber,
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
    },

    async insertTicketComment(comment) {
      await db
        .prepare(`INSERT INTO support_ticket_comments (${COMMENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          comment.id,
          comment.tenantId,
          comment.ticketId,
          comment.authorType,
          comment.authorId,
          comment.authorName,
          comment.authorEmail,
          comment.content,
          comment.isInternal ? 1 : 0,
          comment.createdAt
        )
        .run();
    },

    async listTicketComments(ticketId, includeInternal = false) {
      const clauses = ["ticket_id = ?"];
      const binds: unknown[] = [ticketId];
      if (!includeInternal) {
        clauses.push("is_internal = 0");
      }
      const result = await db
        .prepare(`SELECT ${COMMENT_COLS} FROM support_ticket_comments WHERE ${clauses.join(" AND ")} ORDER BY created_at ASC`)
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToComment);
    },

    async insertTicketAttachment(attachment) {
      await db
        .prepare(`INSERT INTO support_ticket_attachments (${ATTACHMENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          attachment.id,
          attachment.tenantId,
          attachment.ticketId,
          attachment.filename,
          attachment.contentType,
          attachment.sizeBytes,
          attachment.storageKey,
          attachment.createdAt
        )
        .run();
    },

    async listTicketAttachments(ticketId) {
      const result = await db
        .prepare(`SELECT ${ATTACHMENT_COLS} FROM support_ticket_attachments WHERE ticket_id = ? ORDER BY created_at DESC`)
        .bind(ticketId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToAttachment);
    },

    async insertTicketShareToken(shareToken) {
      await db
        .prepare(`INSERT INTO support_ticket_share_tokens (${SHARE_TOKEN_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          shareToken.id,
          shareToken.tenantId,
          shareToken.ticketId,
          shareToken.token,
          shareToken.isActive ? 1 : 0,
          shareToken.expiresAt,
          shareToken.createdAt,
          shareToken.lastAccessedAt
        )
        .run();
    },

    async getTicketShareToken(id) {
      const row = await db
        .prepare(`SELECT ${SHARE_TOKEN_COLS} FROM support_ticket_share_tokens WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToShareToken(row) : null;
    },

    async getTicketShareTokenByToken(token) {
      const row = await db
        .prepare(`SELECT ${SHARE_TOKEN_COLS} FROM support_ticket_share_tokens WHERE token = ?`)
        .bind(token)
        .first<Record<string, unknown>>();
      return row ? rowToShareToken(row) : null;
    },

    async listTicketShareTokens(ticketId) {
      const result = await db
        .prepare(`SELECT ${SHARE_TOKEN_COLS} FROM support_ticket_share_tokens WHERE ticket_id = ? ORDER BY created_at DESC`)
        .bind(ticketId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToShareToken);
    },

    async touchTicketShareToken(token, lastAccessedAt) {
      await db
        .prepare("UPDATE support_ticket_share_tokens SET last_accessed_at = ? WHERE token = ?")
        .bind(lastAccessedAt, token)
        .run();
    },

    async revokeTicketShareToken(id) {
      const row = await db
        .prepare(`SELECT ${SHARE_TOKEN_COLS} FROM support_ticket_share_tokens WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>();
      if (!row) return null;
      await db
        .prepare("UPDATE support_ticket_share_tokens SET is_active = 0 WHERE id = ?")
        .bind(id)
        .run();
      return { ...rowToShareToken(row), isActive: false };
    }
  };
}
