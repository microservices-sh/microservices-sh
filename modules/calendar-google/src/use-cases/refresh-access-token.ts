import { defaultConfig } from "../config";
import { refreshAccessTokenInputSchema } from "../schemas";
import type { GoogleCalendarClient, TokenStore } from "../ports";
import type { CalendarToken } from "../types";

// SINGLE-FLIGHT OAuth refresh. The bug this prevents: N concurrent workers all
// see an expired access token and all POST to Google's token endpoint at once —
// racing refreshes, rate-limit errors, and (with rotating refresh tokens) one
// refresh invalidating another's result. Here exactly one caller wins an atomic
// DB lease and calls Google; the others spin briefly, re-read, and reuse the
// freshly-stored token. D1 serializes writes, so acquireRefreshLock is the
// arbiter — no in-memory mutex (which wouldn't work across isolates) is used.
export async function refreshAccessToken(
  input: unknown,
  deps: {
    tokenStore: TokenStore;
    client: GoogleCalendarClient;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
    // Injected so tests don't actually sleep; defaults to setTimeout.
    sleep?: (ms: number) => Promise<void>;
  }
) {
  const parsed = refreshAccessTokenInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_REFRESH_INPUT", message: "Refresh input is invalid.", issues: parsed.error.issues }
    };
  }

  const leaseMs = deps.config?.refreshLeaseMs ?? defaultConfig.refreshLeaseMs;
  const earlyRefreshMs = parsed.data.earlyRefreshMs;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { tenantId, calendarId, owner } = parsed.data;

  const token = await deps.tokenStore.get(tenantId, calendarId);
  if (!token) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "TOKEN_NOT_FOUND", message: "No connected calendar." } };
  }

  const nowMs = deps.now?.() ?? Date.now();
  // Still-valid (with slack)? Reuse it; no refresh, no lock.
  if (token.accessToken && token.accessTokenExpiresAt - earlyRefreshMs > nowMs) {
    return { ok: true as const, status: 200 as const, data: { accessToken: token.accessToken, refreshed: false } };
  }

  // Try to win the single-flight lease.
  const won = await deps.tokenStore.acquireRefreshLock(tenantId, calendarId, owner, nowMs + leaseMs, nowMs);

  if (!won) {
    // Someone else is refreshing. Wait for the lease window, re-read, reuse.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await sleep(Math.min(250, leaseMs));
      const fresh = await deps.tokenStore.get(tenantId, calendarId);
      const checkMs = deps.now?.() ?? Date.now();
      if (fresh?.accessToken && fresh.accessTokenExpiresAt - earlyRefreshMs > checkMs) {
        return { ok: true as const, status: 200 as const, data: { accessToken: fresh.accessToken, refreshed: false, viaOtherFlight: true } };
      }
      // Lease expired without a result (crashed refresher): try to take over.
      if (!fresh?.refreshLockOwner || (fresh.refreshLockExpiresAt ?? 0) <= checkMs) {
        const tookOver = await deps.tokenStore.acquireRefreshLock(tenantId, calendarId, owner, checkMs + leaseMs, checkMs);
        if (tookOver) return doRefresh(fresh ?? token, owner, deps, earlyRefreshMs);
      }
    }
    return { ok: false as const, status: 503 as const, data: null, error: { code: "REFRESH_CONTENDED", message: "Token refresh did not settle in time; retry." } };
  }

  return doRefresh(token, owner, deps, earlyRefreshMs);
}

async function doRefresh(
  token: CalendarToken,
  owner: string,
  deps: { tokenStore: TokenStore; client: GoogleCalendarClient; now?: () => number },
  _earlyRefreshMs: number
) {
  try {
    const refreshed = await deps.client.refreshToken({ refreshToken: token.refreshToken });
    const nowMs = deps.now?.() ?? Date.now();
    const updated: CalendarToken = {
      ...token,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: nowMs + refreshed.expiresInSeconds * 1000,
      scope: refreshed.scope ?? token.scope,
      tokenType: refreshed.tokenType ?? token.tokenType,
      refreshLockOwner: null,
      refreshLockExpiresAt: null,
      updatedAt: new Date(nowMs).toISOString()
    };
    // releaseRefreshLock persists the new token AND clears the lease atomically.
    await deps.tokenStore.releaseRefreshLock(updated);
    return { ok: true as const, status: 200 as const, data: { accessToken: refreshed.accessToken, refreshed: true } };
  } catch (err) {
    // Clear the lease on failure so a retry isn't blocked by our dead lock.
    const cleared: CalendarToken = { ...token, refreshLockOwner: null, refreshLockExpiresAt: null };
    await deps.tokenStore.releaseRefreshLock(cleared);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, status: 502 as const, data: null, error: { code: "REFRESH_FAILED", message } };
  }
}
