import { connectCalendarInputSchema } from "../schemas";
import type { SyncStateStore, TokenStore } from "../ports";
import type { CalendarSyncState, CalendarToken } from "../types";

// Store the OAuth credentials for a calendar and seed an empty sync cursor. The
// first syncCalendar run will full-sync (syncToken === null) and refresh the
// access token on demand via single-flight. No Google call happens here.
export async function connectCalendar(
  input: unknown,
  deps: { tokenStore: TokenStore; syncStateStore: SyncStateStore; now?: () => number }
) {
  const parsed = connectCalendarInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_CONNECT_INPUT", message: "Connect input is invalid.", issues: parsed.error.issues }
    };
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

  return { ok: true as const, status: 201 as const, data: { tenantId, calendarId, connected: true } };
}
