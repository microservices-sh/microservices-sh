import type { CalendarEventStore, ChannelStore, SyncStateStore, TokenStore } from "../ports";
import type { CalendarChannel, CalendarEvent, CalendarSyncState, CalendarToken } from "../types";

const TOKEN_COLS =
  "id, tenant_id, calendar_id, access_token, refresh_token, scope, token_type, access_token_expires_at, refresh_lock_owner, refresh_lock_expires_at, created_at, updated_at";

function rowToToken(row: Record<string, unknown>): CalendarToken {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    calendarId: String(row.calendar_id),
    accessToken: row.access_token != null ? String(row.access_token) : null,
    refreshToken: String(row.refresh_token),
    scope: row.scope != null ? String(row.scope) : null,
    tokenType: row.token_type != null ? String(row.token_type) : null,
    accessTokenExpiresAt: Number(row.access_token_expires_at ?? 0),
    refreshLockOwner: row.refresh_lock_owner != null ? String(row.refresh_lock_owner) : null,
    refreshLockExpiresAt: row.refresh_lock_expires_at != null ? Number(row.refresh_lock_expires_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1TokenStore(db: D1Database): TokenStore {
  return {
    async get(tenantId, calendarId) {
      const row = await db
        .prepare(`SELECT ${TOKEN_COLS} FROM calendar_tokens WHERE tenant_id = ? AND calendar_id = ?`)
        .bind(tenantId, calendarId)
        .first<Record<string, unknown>>();
      return row ? rowToToken(row) : null;
    },
    async insert(token) {
      await db
        .prepare(`INSERT INTO calendar_tokens (${TOKEN_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          token.id,
          token.tenantId,
          token.calendarId,
          token.accessToken,
          token.refreshToken,
          token.scope,
          token.tokenType,
          token.accessTokenExpiresAt,
          token.refreshLockOwner,
          token.refreshLockExpiresAt,
          token.createdAt,
          token.updatedAt
        )
        .run();
    },
    async update(token) {
      await db
        .prepare(
          `UPDATE calendar_tokens SET access_token = ?, refresh_token = ?, scope = ?, token_type = ?,
             access_token_expires_at = ?, refresh_lock_owner = ?, refresh_lock_expires_at = ?, updated_at = ?
           WHERE tenant_id = ? AND calendar_id = ?`
        )
        .bind(
          token.accessToken,
          token.refreshToken,
          token.scope,
          token.tokenType,
          token.accessTokenExpiresAt,
          token.refreshLockOwner,
          token.refreshLockExpiresAt,
          token.updatedAt,
          token.tenantId,
          token.calendarId
        )
        .run();
    },
    async acquireRefreshLock(tenantId, calendarId, owner, leaseExpiresAtMs, nowMs) {
      // Atomic compare-and-set: claim the lease only when it is free or expired.
      // SQLite serializes writes, so exactly one concurrent caller's UPDATE
      // matches the WHERE clause — that is the single-flight arbiter.
      const result = await db
        .prepare(
          `UPDATE calendar_tokens
             SET refresh_lock_owner = ?, refresh_lock_expires_at = ?
           WHERE tenant_id = ? AND calendar_id = ?
             AND (refresh_lock_owner IS NULL OR refresh_lock_expires_at IS NULL OR refresh_lock_expires_at <= ?)`
        )
        .bind(owner, leaseExpiresAtMs, tenantId, calendarId, nowMs)
        .run();
      const changes = (result.meta as { changes?: number } | undefined)?.changes ?? 0;
      return changes > 0;
    },
    async releaseRefreshLock(token) {
      await db
        .prepare(
          `UPDATE calendar_tokens SET access_token = ?, scope = ?, token_type = ?, access_token_expires_at = ?,
             refresh_lock_owner = NULL, refresh_lock_expires_at = NULL, updated_at = ?
           WHERE tenant_id = ? AND calendar_id = ?`
        )
        .bind(
          token.accessToken,
          token.scope,
          token.tokenType,
          token.accessTokenExpiresAt,
          token.updatedAt,
          token.tenantId,
          token.calendarId
        )
        .run();
    }
  };
}

const SYNC_COLS = "id, tenant_id, calendar_id, sync_token, last_synced_at, resync_count, created_at, updated_at";

function rowToSyncState(row: Record<string, unknown>): CalendarSyncState {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    calendarId: String(row.calendar_id),
    syncToken: row.sync_token != null ? String(row.sync_token) : null,
    lastSyncedAt: row.last_synced_at != null ? String(row.last_synced_at) : null,
    resyncCount: Number(row.resync_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1SyncStateStore(db: D1Database): SyncStateStore {
  return {
    async get(tenantId, calendarId) {
      const row = await db
        .prepare(`SELECT ${SYNC_COLS} FROM calendar_sync_state WHERE tenant_id = ? AND calendar_id = ?`)
        .bind(tenantId, calendarId)
        .first<Record<string, unknown>>();
      return row ? rowToSyncState(row) : null;
    },
    async upsert(state) {
      await db
        .prepare(
          `INSERT INTO calendar_sync_state (${SYNC_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, calendar_id) DO UPDATE SET
             sync_token = excluded.sync_token,
             last_synced_at = excluded.last_synced_at,
             resync_count = excluded.resync_count,
             updated_at = excluded.updated_at`
        )
        .bind(
          state.id,
          state.tenantId,
          state.calendarId,
          state.syncToken,
          state.lastSyncedAt,
          state.resyncCount,
          state.createdAt,
          state.updatedAt
        )
        .run();
    }
  };
}

const CHANNEL_COLS =
  "id, tenant_id, calendar_id, resource_id, token, expiration, status, created_at, updated_at";

function rowToChannel(row: Record<string, unknown>): CalendarChannel {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    calendarId: String(row.calendar_id),
    resourceId: String(row.resource_id),
    token: String(row.token),
    expiration: Number(row.expiration ?? 0),
    status: String(row.status) as CalendarChannel["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1ChannelStore(db: D1Database): ChannelStore {
  return {
    async insert(channel) {
      await db
        .prepare(`INSERT INTO calendar_channels (${CHANNEL_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          channel.id,
          channel.tenantId,
          channel.calendarId,
          channel.resourceId,
          channel.token,
          channel.expiration,
          channel.status,
          channel.createdAt,
          channel.updatedAt
        )
        .run();
    },
    async update(channel) {
      await db
        .prepare(
          `UPDATE calendar_channels SET resource_id = ?, token = ?, expiration = ?, status = ?, updated_at = ? WHERE id = ?`
        )
        .bind(channel.resourceId, channel.token, channel.expiration, channel.status, channel.updatedAt, channel.id)
        .run();
    },
    async get(channelId) {
      const row = await db
        .prepare(`SELECT ${CHANNEL_COLS} FROM calendar_channels WHERE id = ?`)
        .bind(channelId)
        .first<Record<string, unknown>>();
      return row ? rowToChannel(row) : null;
    },
    async listExpiring(beforeMs, limit) {
      const result = await db
        .prepare(
          `SELECT ${CHANNEL_COLS} FROM calendar_channels WHERE status = 'active' AND expiration <= ? ORDER BY expiration ASC LIMIT ?`
        )
        .bind(beforeMs, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToChannel);
    }
  };
}

const EVENT_COLS =
  "id, tenant_id, calendar_id, google_event_id, etag, status, summary, start_at, end_at, recurrence, recurring_event_id, updated, raw, created_at, updated_at";

function rowToEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    calendarId: String(row.calendar_id),
    googleEventId: String(row.google_event_id),
    etag: row.etag != null ? String(row.etag) : null,
    status: String(row.status) as CalendarEvent["status"],
    summary: row.summary != null ? String(row.summary) : null,
    startAt: row.start_at != null ? String(row.start_at) : null,
    endAt: row.end_at != null ? String(row.end_at) : null,
    recurrence: row.recurrence != null ? (JSON.parse(String(row.recurrence)) as string[]) : null,
    recurringEventId: row.recurring_event_id != null ? String(row.recurring_event_id) : null,
    updated: row.updated != null ? String(row.updated) : null,
    raw: row.raw != null ? (JSON.parse(String(row.raw)) as Record<string, unknown>) : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1CalendarEventStore(db: D1Database): CalendarEventStore {
  return {
    async upsert(event) {
      const existing = await db
        .prepare(
          `SELECT id, etag, updated, created_at FROM calendar_events WHERE tenant_id = ? AND calendar_id = ? AND google_event_id = ?`
        )
        .bind(event.tenantId, event.calendarId, event.googleEventId)
        .first<{ id: string; etag: string | null; updated: string | null; created_at: string }>();

      if (!existing) {
        await db
          .prepare(`INSERT INTO calendar_events (${EVENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            event.id,
            event.tenantId,
            event.calendarId,
            event.googleEventId,
            event.etag,
            event.status,
            event.summary,
            event.startAt,
            event.endAt,
            event.recurrence != null ? JSON.stringify(event.recurrence) : null,
            event.recurringEventId,
            event.updated,
            JSON.stringify(event.raw),
            event.createdAt,
            event.updatedAt
          )
          .run();
        return "inserted";
      }

      // Dedup: an unchanged event (same `updated` marker, or same etag) delivered
      // again via push+poll is a duplicate and must not be re-processed.
      if ((event.updated != null && existing.updated === event.updated) || (event.etag != null && existing.etag === event.etag)) {
        return "duplicate";
      }

      await db
        .prepare(
          `UPDATE calendar_events SET etag = ?, status = ?, summary = ?, start_at = ?, end_at = ?, recurrence = ?,
             recurring_event_id = ?, updated = ?, raw = ?, updated_at = ?
           WHERE tenant_id = ? AND calendar_id = ? AND google_event_id = ?`
        )
        .bind(
          event.etag,
          event.status,
          event.summary,
          event.startAt,
          event.endAt,
          event.recurrence != null ? JSON.stringify(event.recurrence) : null,
          event.recurringEventId,
          event.updated,
          JSON.stringify(event.raw),
          event.updatedAt,
          event.tenantId,
          event.calendarId,
          event.googleEventId
        )
        .run();
      return "updated";
    },
    async get(tenantId, calendarId, googleEventId) {
      const row = await db
        .prepare(`SELECT ${EVENT_COLS} FROM calendar_events WHERE tenant_id = ? AND calendar_id = ? AND google_event_id = ?`)
        .bind(tenantId, calendarId, googleEventId)
        .first<Record<string, unknown>>();
      return row ? rowToEvent(row) : null;
    },
    async list(tenantId, calendarId, limit) {
      const result = await db
        .prepare(`SELECT ${EVENT_COLS} FROM calendar_events WHERE tenant_id = ? AND calendar_id = ? ORDER BY start_at ASC LIMIT ?`)
        .bind(tenantId, calendarId, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToEvent);
    }
  };
}
