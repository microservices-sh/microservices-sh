import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { beforeCalendarSync } from "../hooks";
import { syncCalendarInputSchema } from "../schemas";
import { calendarGoogleMeta } from "../meta";
import { applyEvents } from "./upsert-events";
import type { CalendarEventStore, GoogleCalendarClient, SyncStateStore, TokenStore } from "../ports";
import type { CalendarSyncState, DomainEvent } from "../types";

// Incremental sync via Google's syncToken, with the critical fallback agents miss:
// when Google invalidates the cursor it returns HTTP 410 Gone. Naively this looks
// like an error and sync wedges forever. Here a 410 (surfaced by the client as
// { gone: true }) clears the stored syncToken and re-runs a FULL sync, then stores
// the fresh nextSyncToken. The access token must be valid before calling —
// refreshAccessToken (single-flight) is the caller's job; we accept it injected.
//
// Two layers of customization gate the sync (Plan 25 §5):
//   1. the local config seam `beforeCalendarSync` (per-app override)
//   2. the cross-module `beforeCalendarSync` guard chain, injected by the composed
//      app via deps.beforeSyncHooks — guards may veto a run.
export async function syncCalendar(
  input: unknown,
  deps: {
    accessToken: string;
    client: GoogleCalendarClient;
    syncStateStore: SyncStateStore;
    eventStore: CalendarEventStore;
    tokenStore?: TokenStore;
    now?: () => number;
    correlationId?: string;
    beforeSyncHooks?: ResolvedHook[];
  }
) {
  const meta = calendarGoogleMeta(deps);

  const parsed = syncCalendarInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "calendar-google.INVALID_SYNC_INPUT", message: "Sync input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const { tenantId, calendarId, maxPages } = parsed.data;

  const proceed = await beforeCalendarSync({ tenantId, calendarId });
  if (!proceed) {
    return ok(200, { tenantId, calendarId, skipped: true }, meta);
  }

  const hooked = await runHooks(
    "beforeCalendarSync",
    { tenantId, calendarId },
    { correlationId: meta.correlationId },
    deps.beforeSyncHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
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

  const event: DomainEvent = {
    name: "calendar-google.synced",
    correlationId: meta.correlationId,
    payload: {
      tenantId,
      calendarId,
      didResync,
      inserted: totalInserted,
      updated: totalUpdated,
      deduped: totalDeduped
    }
  };

  return ok(
    200,
    {
      tenantId,
      calendarId,
      didResync,
      resyncCount: state.resyncCount,
      inserted: totalInserted,
      updated: totalUpdated,
      deduped: totalDeduped,
      syncToken: state.syncToken,
      event
    },
    meta
  );
}
