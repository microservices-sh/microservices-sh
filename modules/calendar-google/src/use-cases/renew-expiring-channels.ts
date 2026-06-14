import { onChannelRenewed } from "../hooks";
import { renewExpiringChannelsInputSchema } from "../schemas";
import type { ChannelStore, GoogleCalendarClient, TokenStore } from "../ports";
import type { CalendarChannel } from "../types";

// Renew watch channels BEFORE they expire. Google push channels live ~7 days; if
// nobody renews them, push delivery silently stops and the calendar appears to
// "stop syncing after a week" with no error anywhere — the single most common
// Google Calendar integration failure. This finds channels expiring within the
// renewal window, registers a fresh channel, then stops the old one (renew-then-
// stop, so there is never a gap with no active channel). Designed to be driven by
// a jobs-workflows schedule. accessToken is resolved per channel via tokenStore +
// the caller's refresh; we accept a resolver to keep this use case neutral.
export async function renewExpiringChannels(
  input: unknown,
  deps: {
    channelStore: ChannelStore;
    client: GoogleCalendarClient;
    tokenStore: TokenStore;
    // Resolve a valid access token for a connection (caller wires single-flight
    // refresh here). Return null to skip a connection whose token can't be refreshed.
    resolveAccessToken: (tenantId: string, calendarId: string) => Promise<string | null>;
    now?: () => number;
  }
) {
  const parsed = renewExpiringChannelsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_RENEW_INPUT", message: "Renew input is invalid.", issues: parsed.error.issues }
    };
  }

  const nowMs = deps.now?.() ?? Date.now();
  const cutoff = nowMs + parsed.data.renewWithinMs;
  const expiring = await deps.channelStore.listExpiring(cutoff, parsed.data.limit);

  const renewed: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const old of expiring) {
    const accessToken = await deps.resolveAccessToken(old.tenantId, old.calendarId);
    if (!accessToken) {
      skipped.push(old.id);
      continue;
    }

    try {
      const newChannelId = "chn_" + crypto.randomUUID();
      const newToken = crypto.randomUUID();
      const watch = await deps.client.watch({
        accessToken,
        calendarId: old.calendarId,
        channelId: newChannelId,
        token: newToken,
        callbackUrl: parsed.data.callbackUrl,
        ttlMs: parsed.data.ttlMs
      });

      const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
      const fresh: CalendarChannel = {
        id: watch.channelId,
        tenantId: old.tenantId,
        calendarId: old.calendarId,
        resourceId: watch.resourceId,
        token: newToken,
        expiration: watch.expiration,
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso
      };
      // Register the new channel first, so push delivery never has a gap.
      await deps.channelStore.insert(fresh);

      // Then stop the old one (best-effort) and mark it stopped.
      try {
        await deps.client.stopChannel({ accessToken, channelId: old.id, resourceId: old.resourceId });
      } catch {
        // A failed stop is non-fatal: the old channel will lapse on its own.
      }
      old.status = "stopped";
      old.updatedAt = nowIso;
      await deps.channelStore.update(old);

      await onChannelRenewed(fresh);
      renewed.push(fresh.id);
    } catch {
      failed.push(old.id);
    }
  }

  return {
    ok: true as const,
    status: 200 as const,
    data: { considered: expiring.length, renewed, skipped, failed }
  };
}
