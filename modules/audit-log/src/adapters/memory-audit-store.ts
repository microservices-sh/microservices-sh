import type { AuditEventStore } from "../ports";
import type { AuditEvent } from "../types";

export function createMemoryAuditEventStore(): AuditEventStore {
  const events: AuditEvent[] = [];

  return {
    async append(event) {
      events.push({ ...event });
    },

    async list(filter) {
      let rows = [...events];
      if (filter.entityType) rows = rows.filter((event) => event.entityType === filter.entityType);
      if (filter.entityId) rows = rows.filter((event) => event.entityId === filter.entityId);
      if (filter.eventName) rows = rows.filter((event) => event.eventName === filter.eventName);
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.slice(0, filter.limit ?? 100);
    }
  };
}
