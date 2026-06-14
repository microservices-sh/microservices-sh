import { beforeCalendarSync } from "../hooks";
import { syncCalendarInputSchema } from "../schemas";
import { applyEvents } from "./upsert-events";
import type { CalendarEventStore, GoogleCalendarClient, SyncStateStore, TokenStore } from "../ports";
import type { CalendarSyncState } from "../types";

// Incremental sync via Google's syncToken, with the critical fallback agents miss:
// when Google invalidates the cursor it returns HTTP 410 Gone. Naively this looks
// like an error and sync wedges forever. Here a 410 (surfaced by the client as
// { gone: true }) clears the stored syncToken and re-runs a FULL sync, then stores
// the fresh nextSyncToken. The access token must be valid before calling —
// refreshAccessToken (single-flight) is the caller's job; we accept it injected.
export async function syncCalendar(
  input: unknown,
  deps: {
    accessToken: string;
    client: GoogleCalendarClient;
    syncStateStore: SyncStateStore;
    eventStore: CalendarEventStore;
    tokenStore?: TokenStore;
    now?: () => number;
  }
) {
  const parsed = syncCalendarInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_SYNC_INPUT", message: "Sync input is invalid.", issues: parsed.error.issues }
    };
  }

  const { tenantId, calendarId, maxPages } = parsed.data;

  const proceed = await beforeCalendarSync({ tenantId, calendarId });
  if (!proceed) {
    return { ok: true as const, status: 200 as const, data: { tenantId, calendarId, skipped: true } };
  }

  const nowIso = () => new Date(deps.now?.() ?? Date.now()).toISOString();
  const existing = await deps.syncStateStore.get(tenantId, calendarId);
  const state: CalendarSyncState = existing ?? {
    id: "syn_" + crypto.randomUUID().slice(0, 16),
    tenantId,
    calendarId,
    syncToken: null,
    lastSyncedAt: null,
    resyncCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  let syncToken = state.syncToken;
  let didResync = false;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalDeduped = 0;
  let pageToken: string | null | undefined = null;
  let nextSyncToken: string | null | undefined = syncToken;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await deps.client.listEvents({
      accessToken: deps.accessToken,
      calendarId,
      syncToken: pageToken ? null : syncToken,
      pageToken
    });

    // 410 Gone: the cursor is dead. Drop it, bump resyncCount, restart full sync.
    if ("gone" in result) {
      syncToken = null;
      pageToken = null;
      nextSyncToken = null;
      didResync = true;
      state.resyncCount += 1;
      // Restart the page loop from scratch with no cursor (full sync).
      page = -1;
      continue;
    }

    const batch = await applyEvents(result.events, { eventStore: deps.eventStore, now: deps.now }, { tenantId, calendarId });
    totalInserted += batch.inserted;
    totalUpdated += batch.updated;
    totalDeduped += batch.deduped;

    if (result.nextPageToken) {
      pageToken = result.nextPageToken;
      continue;
    }

    // Final page: persist the new cursor for the next incremental run.
    nextSyncToken = result.nextSyncToken ?? syncToken;
    break;
  }

  state.syncToken = nextSyncToken ?? null;
  state.lastSyncedAt = nowIso();
  state.updatedAt = nowIso();
  await deps.syncStateStore.upsert(state);

  return {
    ok: true as const,
    status: 200 as const,
    data: {
      tenantId,
      calendarId,
      didResync,
      resyncCount: state.resyncCount,
      inserted: totalInserted,
      updated: totalUpdated,
      deduped: totalDeduped,
      syncToken: state.syncToken
    }
  };
}
