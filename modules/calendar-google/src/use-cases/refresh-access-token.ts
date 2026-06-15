import { ok, err } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { refreshAccessTokenInputSchema } from "../schemas";
import { calendarGoogleMeta } from "../meta";
import type { GoogleCalendarClient, TokenStore } from "../ports";
import type { CalendarToken, DomainEvent } from "../types";

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
    correlationId?: string;
    // Injected so tests don't actually sleep; defaults to setTimeout.
    sleep?: (ms: number) => Promise<void>;
  }
) {
  const meta = calendarGoogleMeta(deps);

  const parsed = refreshAccessTokenInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "calendar-google.INVALID_REFRESH_INPUT", message: "Refresh input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const leaseMs = deps.config?.refreshLeaseMs ?? defaultConfig.refreshLeaseMs;
  const earlyRefreshMs = parsed.data.earlyRefreshMs;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { tenantId, calendarId, owner } = parsed.data;

  const token = await deps.tokenStore.get(tenantId, calendarId);
  if (!token) {
    return err(404, { code: "calendar-google.TOKEN_NOT_FOUND", message: "No connected calendar." }, meta);
  }

  const nowMs = deps.now?.() ?? Date.now();
  // Still-valid (with slack)? Reuse it; no refresh, no lock.
  if (token.accessToken && token.accessTokenExpiresAt - earlyRefreshMs > nowMs) {
    return ok(200, { accessToken: token.accessToken, refreshed: false }, meta);
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
        return ok(200, { accessToken: fresh.accessToken, refreshed: false, viaOtherFlight: true }, meta);
      }
      // Lease expired without a result (crashed refresher): try to take over.
      if (!fresh?.refreshLockOwner || (fresh.refreshLockExpiresAt ?? 0) <= checkMs) {
        const tookOver = await deps.tokenStore.acquireRefreshLock(tenantId, calendarId, owner, checkMs + leaseMs, checkMs);
        if (tookOver) return doRefresh(fresh ?? token, deps, meta);
      }
    }
    return err(503, { code: "calendar-google.REFRESH_CONTENDED", message: "Token refresh did not settle in time; retry." }, meta);
  }

  return doRefresh(token, deps, meta);
}

async function doRefresh(
  token: CalendarToken,
  deps: { tokenStore: TokenStore; client: GoogleCalendarClient; now?: () => number },
  meta: Meta
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
    const event: DomainEvent = {
      name: "calendar-google.token.refreshed",
      correlationId: meta.correlationId,
      payload: { tenantId: token.tenantId, calendarId: token.calendarId }
    };
    return ok(200, { accessToken: refreshed.accessToken, refreshed: true, event }, meta);
  } catch (cause) {
    // Clear the lease on failure so a retry isn't blocked by our dead lock.
    const cleared: CalendarToken = { ...token, refreshLockOwner: null, refreshLockExpiresAt: null };
    await deps.tokenStore.releaseRefreshLock(cleared);
    const message = cause instanceof Error ? cause.message : String(cause);
    return err(502, { code: "calendar-google.REFRESH_FAILED", message }, meta);
  }
}
