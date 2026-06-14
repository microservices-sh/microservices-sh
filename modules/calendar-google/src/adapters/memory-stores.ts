import type { CalendarEventStore, ChannelStore, SyncStateStore, TokenStore } from "../ports";
import type { CalendarChannel, CalendarEvent, CalendarSyncState, CalendarToken } from "../types";

function key(tenantId: string, calendarId: string): string {
  return `${tenantId}:${calendarId}`;
}

// In-memory TokenStore. The lock is enforced single-threadedly here (JS isolate)
// which is exactly the single-flight contract: acquire iff free/expired.
export function createMemoryTokenStore(): TokenStore {
  const byConn = new Map<string, CalendarToken>();

  return {
    async get(tenantId, calendarId) {
      const t = byConn.get(key(tenantId, calendarId));
      return t ? { ...t } : null;
    },
    async insert(token) {
      byConn.set(key(token.tenantId, token.calendarId), { ...token });
    },
    async update(token) {
      byConn.set(key(token.tenantId, token.calendarId), { ...token });
    },
    async acquireRefreshLock(tenantId, calendarId, owner, leaseExpiresAtMs, nowMs) {
      const t = byConn.get(key(tenantId, calendarId));
      if (!t) return false;
      const held = t.refreshLockOwner !== null && (t.refreshLockExpiresAt ?? 0) > nowMs;
      if (held) return false;
      t.refreshLockOwner = owner;
      t.refreshLockExpiresAt = leaseExpiresAtMs;
      return true;
    },
    async releaseRefreshLock(token) {
      byConn.set(key(token.tenantId, token.calendarId), { ...token, refreshLockOwner: null, refreshLockExpiresAt: null });
    }
  };
}

export function createMemorySyncStateStore(): SyncStateStore {
  const byConn = new Map<string, CalendarSyncState>();
  return {
    async get(tenantId, calendarId) {
      const s = byConn.get(key(tenantId, calendarId));
      return s ? { ...s } : null;
    },
    async upsert(state) {
      byConn.set(key(state.tenantId, state.calendarId), { ...state });
    }
  };
}

export function createMemoryChannelStore(): ChannelStore {
  const byId = new Map<string, CalendarChannel>();
  return {
    async insert(channel) {
      byId.set(channel.id, { ...channel });
    },
    async update(channel) {
      byId.set(channel.id, { ...channel });
    },
    async get(channelId) {
      const c = byId.get(channelId);
      return c ? { ...c } : null;
    },
    async listExpiring(beforeMs, limit) {
      return [...byId.values()]
        .filter((c) => c.status === "active" && c.expiration <= beforeMs)
        .sort((a, b) => a.expiration - b.expiration)
        .slice(0, limit)
        .map((c) => ({ ...c }));
    }
  };
}

export function createMemoryCalendarEventStore(): CalendarEventStore {
  const byKey = new Map<string, CalendarEvent>();
  const eventKey = (tenantId: string, calendarId: string, googleEventId: string) =>
    `${tenantId}:${calendarId}:${googleEventId}`;

  return {
    async upsert(event) {
      const k = eventKey(event.tenantId, event.calendarId, event.googleEventId);
      const existing = byKey.get(k);
      if (!existing) {
        byKey.set(k, { ...event });
        return "inserted";
      }
      // Dedup: same `updated` marker (or same etag) => unchanged => duplicate.
      if (
        (event.updated !== null && existing.updated === event.updated) ||
        (event.etag !== null && existing.etag === event.etag)
      ) {
        return "duplicate";
      }
      byKey.set(k, { ...event, id: existing.id, createdAt: existing.createdAt });
      return "updated";
    },
    async get(tenantId, calendarId, googleEventId) {
      const e = byKey.get(eventKey(tenantId, calendarId, googleEventId));
      return e ? { ...e } : null;
    },
    async list(tenantId, calendarId, limit) {
      return [...byKey.values()]
        .filter((e) => e.tenantId === tenantId && e.calendarId === calendarId)
        .sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""))
        .slice(0, limit)
        .map((e) => ({ ...e }));
    }
  };
}
