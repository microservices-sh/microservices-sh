import type {
  CalendarChannel,
  CalendarEvent,
  CalendarSyncState,
  CalendarToken,
  ListEventsResult,
  RawGoogleEvent,
  RefreshedToken,
  WatchResult
} from "../types";

// The only place that talks to Google over HTTP. Injected into use cases so the
// network boundary is mockable and the use cases stay framework-/fetch-free. The
// concrete adapter (adapters/fetch-google-client.ts) is the ONLY use of fetch.
export interface GoogleCalendarClient {
  // events.list. Pass a syncToken for an incremental pull, or omit it for a full
  // sync. On an invalidated cursor Google returns HTTP 410 — the adapter MUST
  // signal that as { gone: true } (not throw) so syncCalendar can resync.
  listEvents(
    args: { accessToken: string; calendarId: string; syncToken?: string | null; pageToken?: string | null }
  ): Promise<ListEventsResult | { gone: true }>;

  // events.watch — register a push channel. Returns the resource id + expiry.
  watch(
    args: { accessToken: string; calendarId: string; channelId: string; token: string; callbackUrl: string; ttlMs: number }
  ): Promise<WatchResult>;

  // channels.stop — tear down an old channel after a successful renewal.
  stopChannel(args: { accessToken: string; channelId: string; resourceId: string }): Promise<void>;

  // OAuth refresh: exchange the long-lived refresh token for a new access token.
  refreshToken(args: { refreshToken: string }): Promise<RefreshedToken>;
}

export interface TokenStore {
  get(tenantId: string, calendarId: string): Promise<CalendarToken | null>;
  insert(token: CalendarToken): Promise<void>;
  update(token: CalendarToken): Promise<void>;

  // Single-flight refresh lock. Atomically claims the lease for `owner` iff it is
  // currently free or expired (<= nowMs). Returns true if this caller won the
  // lease — only the winner calls Google; everyone else waits and re-reads.
  acquireRefreshLock(
    tenantId: string,
    calendarId: string,
    owner: string,
    leaseExpiresAtMs: number,
    nowMs: number
  ): Promise<boolean>;

  // Persist the refreshed token and clear the lease in one write.
  releaseRefreshLock(token: CalendarToken): Promise<void>;
}

export interface SyncStateStore {
  get(tenantId: string, calendarId: string): Promise<CalendarSyncState | null>;
  upsert(state: CalendarSyncState): Promise<void>;
}

export interface ChannelStore {
  insert(channel: CalendarChannel): Promise<void>;
  update(channel: CalendarChannel): Promise<void>;
  get(channelId: string): Promise<CalendarChannel | null>;
  // Active channels expiring at or before `beforeMs` — drives renewal.
  listExpiring(beforeMs: number, limit: number): Promise<CalendarChannel[]>;
}

export interface CalendarEventStore {
  // Idempotent upsert keyed on (tenantId, calendarId, googleEventId). Returns
  // "inserted" | "updated" | "duplicate" so push+poll dedup is observable: the
  // same event delivered twice with an unchanged `updated` marker is "duplicate"
  // and must not be re-processed (no double hook fire).
  upsert(event: CalendarEvent): Promise<"inserted" | "updated" | "duplicate">;
  get(tenantId: string, calendarId: string, googleEventId: string): Promise<CalendarEvent | null>;
  list(tenantId: string, calendarId: string, limit: number): Promise<CalendarEvent[]>;
}

// Re-exported helper type so callers can write adapters against the raw shape.
export type { RawGoogleEvent };
