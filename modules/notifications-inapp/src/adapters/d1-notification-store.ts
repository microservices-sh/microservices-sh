import type { NotificationStore } from "../ports";
import type { Notification, NotificationListFilter } from "../types";

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type),
    title: row.title != null ? String(row.title) : null,
    body: row.body != null ? String(row.body) : null,
    data: JSON.parse(String(row.data ?? "{}")) as Record<string, unknown>,
    readAt: row.read_at != null ? String(row.read_at) : null,
    dedupKey: row.dedup_key != null ? String(row.dedup_key) : null,
    createdAt: String(row.created_at)
  };
}

export function createD1NotificationStore(db: D1Database): NotificationStore {
  return {
    async insert(notification) {
      await db
        .prepare(
          "INSERT INTO notifications (id, user_id, type, title, body, data, read_at, dedup_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          notification.id,
          notification.userId,
          notification.type,
          notification.title,
          notification.body,
          JSON.stringify(notification.data),
          notification.readAt,
          notification.dedupKey,
          notification.createdAt
        )
        .run();
    },

    async listForUser(userId, filter: NotificationListFilter) {
      // Always scoped by user_id first — never a cross-user read.
      const clauses = ["user_id = ?"];
      const binds: unknown[] = [userId];
      if (filter.unreadOnly) {
        clauses.push("read_at IS NULL");
      }
      if (filter.sinceIso) {
        clauses.push("created_at > ?");
        binds.push(filter.sinceIso);
      }
      const limit = filter.limit ?? 50;
      const result = await db
        .prepare(
          `SELECT id, user_id, type, title, body, data, read_at, dedup_key, created_at FROM notifications WHERE ${clauses.join(
            " AND "
          )} ORDER BY created_at DESC LIMIT ?`
        )
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToNotification);
    },

    async get(id, userId) {
      const row = await db
        .prepare(
          "SELECT id, user_id, type, title, body, data, read_at, dedup_key, created_at FROM notifications WHERE id = ? AND user_id = ?"
        )
        .bind(id, userId)
        .first<Record<string, unknown>>();
      return row ? rowToNotification(row) : null;
    },

    async markRead(ids, userId) {
      if (ids.length === 0) return 0;
      const nowIso = new Date().toISOString();
      const placeholders = ids.map(() => "?").join(", ");
      // Scoped by user_id so a user can only mark their own; only flips unread
      // rows so readAt is preserved (idempotent).
      const result = await db
        .prepare(
          `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders})`
        )
        .bind(nowIso, userId, ...ids)
        .run();
      return result.meta?.changes ?? 0;
    },

    async markAllRead(userId) {
      const nowIso = new Date().toISOString();
      const result = await db
        .prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL")
        .bind(nowIso, userId)
        .run();
      return result.meta?.changes ?? 0;
    },

    async unreadCount(userId) {
      const row = await db
        .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL")
        .bind(userId)
        .first<{ c: number }>();
      return Number(row?.c ?? 0);
    },

    async recordDedupKey(userId, dedupKey) {
      const row = await db
        .prepare(
          "SELECT id, user_id, type, title, body, data, read_at, dedup_key, created_at FROM notifications WHERE user_id = ? AND dedup_key = ?"
        )
        .bind(userId, dedupKey)
        .first<Record<string, unknown>>();
      return row ? rowToNotification(row) : null;
    }
  };
}
