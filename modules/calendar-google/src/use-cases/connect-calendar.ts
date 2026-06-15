import { ok, err } from "@microservices-sh/connection-contract";
import { connectCalendarInputSchema } from "../schemas";
import { calendarGoogleMeta } from "../meta";
import type { SyncStateStore, TokenStore } from "../ports";
import type { CalendarSyncState, CalendarToken, DomainEvent } from "../types";

// Store the OAuth credentials for a calendar and seed an empty sync cursor. The
// first syncCalendar run will full-sync (syncToken === null) and refresh the
// access token on demand via single-flight. No Google call happens here.
export async function connectCalendar(
  input: unknown,
  deps: { tokenStore: TokenStore; syncStateStore: SyncStateStore; now?: () => number; correlationId?: string }
) {
  const meta = calendarGoogleMeta(deps);

  const parsed = connectCalendarInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "calendar-google.INVALID_CONNECT_INPUT", message: "Connect input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const { tenantId, calendarId } = parsed.data;
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();

  const existing = await deps.tokenStore.get(tenantId, calendarId);
  const token: CalendarToken = {
    id: existing?.id ?? "tok_" + crypto.randomUUID().slice(0, 16),
    tenantId,
    calendarId,
    accessToken: parsed.data.accessToken ?? null,
    refreshToken: parsed.data.refreshToken,
    scope: parsed.data.scope ?? null,
    tokenType: parsed.data.tokenType ?? null,
    accessTokenExpiresAt: parsed.data.accessTokenExpiresAt,
    refreshLockOwner: null,
    refreshLockExpiresAt: null,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso
  };

  if (existing) {
    await deps.tokenStore.update(token);
  } else {
    await deps.tokenStore.insert(token);
  }

  const existingState = await deps.syncStateStore.get(tenantId, calendarId);
  if (!existingState) {
    const state: CalendarSyncState = {
      id: "syn_" + crypto.randomUUID().slice(0, 16),
      tenantId,
      calendarId,
      syncToken: null,
      lastSyncedAt: null,
      resyncCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await deps.syncStateStore.upsert(state);
  }

  const event: DomainEvent = {
    name: "calendar-google.connected",
    correlationId: meta.correlationId,
    payload: { tenantId, calendarId }
  };

  return ok(201, { tenantId, calendarId, connected: true, event }, meta);
}
