import type { NotificationStore } from "../ports";
import type { Notification, NotificationListFilter } from "../types";

export function createMemoryNotificationStore(): NotificationStore {
  const notifications: Notification[] = [];

  return {
    async insert(notification) {
      notifications.push({ ...notification });
    },

    async listForUser(userId, filter: NotificationListFilter) {
      let rows = notifications.filter((n) => n.userId === userId);
      if (filter.unreadOnly) rows = rows.filter((n) => n.readAt === null);
      if (filter.sinceIso) rows = rows.filter((n) => n.createdAt > filter.sinceIso!);
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.slice(0, filter.limit ?? 50).map((n) => ({ ...n }));
    },

    async get(id, userId) {
      const found = notifications.find((n) => n.id === id && n.userId === userId);
      return found ? { ...found } : null;
    },

    async markRead(ids, userId) {
      const nowIso = new Date().toISOString();
      const idSet = new Set(ids);
      let updated = 0;
      for (const n of notifications) {
        if (n.userId === userId && n.readAt === null && idSet.has(n.id)) {
          n.readAt = nowIso;
          updated += 1;
        }
      }
      return updated;
    },

    async markAllRead(userId) {
      const nowIso = new Date().toISOString();
      let updated = 0;
      for (const n of notifications) {
        if (n.userId === userId && n.readAt === null) {
          n.readAt = nowIso;
          updated += 1;
        }
      }
      return updated;
    },

    async unreadCount(userId) {
      return notifications.filter((n) => n.userId === userId && n.readAt === null).length;
    },

    async recordDedupKey(userId, dedupKey) {
      const found = notifications.find((n) => n.userId === userId && n.dedupKey === dedupKey);
      return found ? { ...found } : null;
    }
  };
}
