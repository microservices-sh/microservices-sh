// Google Calendar sync domain types. Money-free vertical module; the hard parts
// are token lifecycle, channel renewal, sync-cursor invalidation, recurrence
// expansion, and dedup — see the use cases and src/rrule.ts.

// Identifies a single connected calendar within a tenant.
export interface CalendarConnection {
  tenantId: string;
  calendarId: string;
}

// OAuth token state for one connection. accessToken may be stale/expired; the
// single-flight refreshAccessToken use case keeps it fresh without racing.
export interface CalendarToken {
  id: string;
  tenantId: string;
  calendarId: string;
  accessToken: string | null;
  refreshToken: string;
  scope: string | null;
  tokenType: string | null;
  // Absolute access-token expiry, epoch ms.
  accessTokenExpiresAt: number;
  // Single-flight refresh lease. Null when no refresh is in progress.
  refreshLockOwner: string | null;
  refreshLockExpiresAt: number | null;
  createdAt: string;
  updatedAt: string;
}

// Incremental sync cursor per calendar. syncToken === null means "do a full sync"
// (first run, or after a 410 Gone invalidation).
export interface CalendarSyncState {
  id: string;
  tenantId: string;
  calendarId: string;
  syncToken: string | null;
  lastSyncedAt: string | null;
  resyncCount: number;
  createdAt: string;
  updatedAt: string;
}

// A registered Google push (watch) channel. Channels expire (~7 days); near-expiry
// channels are renewed so push delivery does not silently stop.
export interface CalendarChannel {
  id: string;
  tenantId: string;
  calendarId: string;
  resourceId: string;
  token: string;
  // Channel expiry, epoch ms.
  expiration: number;
  status: "active" | "stopped";
  createdAt: string;
  updatedAt: string;
}

// A cached calendar event. Deduped by (tenantId, calendarId, googleEventId).
export interface CalendarEvent {
  id: string;
  tenantId: string;
  calendarId: string;
  googleEventId: string;
  etag: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  summary: string | null;
  startAt: string | null;
  endAt: string | null;
  // RRULE strings as returned by Google ("RRULE:FREQ=WEEKLY;..."), when recurring.
  recurrence: string[] | null;
  recurringEventId: string | null;
  // Google's per-event change marker; identical value => no re-processing needed.
  updated: string | null;
  raw: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Shape returned by GoogleCalendarClient.listEvents — a normalized subset of the
// Google API events.list response.
export interface RawGoogleEvent {
  id: string;
  etag?: string | null;
  status?: string | null;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  recurrence?: string[] | null;
  recurringEventId?: string | null;
  updated?: string | null;
  [key: string]: unknown;
}

export interface ListEventsResult {
  events: RawGoogleEvent[];
  // Present on the final page of a successful sync; persist as the next cursor.
  nextSyncToken?: string | null;
  // Present when more pages remain in this sync run.
  nextPageToken?: string | null;
}

// A successful token-refresh response from Google's OAuth endpoint.
export interface RefreshedToken {
  accessToken: string;
  expiresInSeconds: number;
  scope?: string | null;
  tokenType?: string | null;
}

export interface WatchResult {
  channelId: string;
  resourceId: string;
  // Channel expiry, epoch ms.
  expiration: number;
}

// A lifecycle domain event carried out of a use-case Result. correlationId is
// threaded from the request meta so emitters/consumers stay correlated (Plan 25 §4).
export interface DomainEvent {
  name: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

// A single expanded instance of a recurring event (pure, from src/rrule.ts).
export interface ExpandedInstance {
  // Instance start/end as RFC3339 strings (UTC for dateTime inputs).
  startAt: string;
  endAt: string;
}
