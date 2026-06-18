import type { MediaStore } from "../ports";
import type { MediaFile, MediaFileStatus, UploadTicket, UploadTicketStatus } from "../types";

function rowToTicket(row: Record<string, unknown>): UploadTicket {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerId: row.owner_id == null ? null : String(row.owner_id),
    key: String(row.key),
    contentType: String(row.content_type),
    originalName: String(row.original_name),
    maxBytes: Number(row.max_bytes ?? 0),
    status: String(row.status) as UploadTicketStatus,
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at)
  };
}

function rowToFile(row: Record<string, unknown>): MediaFile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerId: row.owner_id == null ? null : String(row.owner_id),
    key: String(row.key),
    contentType: String(row.content_type),
    bytes: Number(row.bytes ?? 0),
    originalName: String(row.original_name),
    status: String(row.status) as MediaFileStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

const TICKET_COLS = "id, tenant_id, owner_id, key, content_type, original_name, max_bytes, status, expires_at, created_at";
const FILE_COLS = "id, tenant_id, owner_id, key, content_type, bytes, original_name, status, created_at, updated_at";

export function createD1MediaStore(db: D1Database): MediaStore {
  return {
    async insertTicket(ticket) {
      await db
        .prepare(`INSERT INTO upload_tickets (${TICKET_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          ticket.id,
          ticket.tenantId,
          ticket.ownerId,
          ticket.key,
          ticket.contentType,
          ticket.originalName,
          ticket.maxBytes,
          ticket.status,
          ticket.expiresAt,
          ticket.createdAt
        )
        .run();
    },

    async getTicket(id) {
      const row = await db.prepare(`SELECT ${TICKET_COLS} FROM upload_tickets WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToTicket(row) : null;
    },

    async updateTicket(ticket) {
      await db
        .prepare("UPDATE upload_tickets SET status = ? WHERE id = ?")
        .bind(ticket.status, ticket.id)
        .run();
    },

    async listExpiredTickets(nowIso, limit) {
      const result = await db
        .prepare(
          `SELECT ${TICKET_COLS} FROM upload_tickets WHERE status = 'pending' AND expires_at <= ? ORDER BY expires_at ASC LIMIT ?`
        )
        .bind(nowIso, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToTicket);
    },

    async insertFile(file) {
      await db
        .prepare(`INSERT INTO media_files (${FILE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          file.id,
          file.tenantId,
          file.ownerId,
          file.key,
          file.contentType,
          file.bytes,
          file.originalName,
          file.status,
          file.createdAt,
          file.updatedAt
        )
        .run();
    },

    async getFile(id) {
      const row = await db.prepare(`SELECT ${FILE_COLS} FROM media_files WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToFile(row) : null;
    },

    async updateFile(file) {
      await db
        .prepare("UPDATE media_files SET status = ?, updated_at = ? WHERE id = ?")
        .bind(file.status, file.updatedAt, file.id)
        .run();
    },

    async listFiles(filter) {
      let sql = `SELECT ${FILE_COLS} FROM media_files WHERE tenant_id = ? AND status = ?`;
      const values: unknown[] = [filter.tenantId, filter.status ?? "active"];
      if (filter.ownerId !== undefined) {
        if (filter.ownerId === null) {
          sql += " AND owner_id IS NULL";
        } else {
          sql += " AND owner_id = ?";
          values.push(filter.ownerId);
        }
      }
      sql += " ORDER BY created_at DESC LIMIT ?";
      values.push(filter.limit ?? 100);

      const result = await db
        .prepare(sql)
        .bind(...values)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToFile);
    }
  };
}
