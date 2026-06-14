import type { GoogleCalendarClient } from "../ports";
import type { ListEventsResult, RawGoogleEvent, RefreshedToken, WatchResult } from "../types";

// THE network boundary. This is the only file that calls fetch — use cases stay
// fetch-free and talk to GoogleCalendarClient. Two things are load-bearing here:
//   1. listEvents surfaces a 410 as { gone: true } instead of throwing, so
//      syncCalendar can full-resync on cursor invalidation.
//   2. token refresh hits the OAuth endpoint with the injected client credentials.
export interface FetchGoogleClientConfig {
  // OAuth client credentials for the refresh grant. Secrets — injected, never
  // hard-coded; sourcing them is the host's responsibility (approval-gated).
  clientId: string;
  clientSecret: string;
  // Overridable for tests / proxies.
  apiBaseUrl?: string;
  tokenUrl?: string;
  // Injectable fetch for testing; defaults to global fetch.
  fetchImpl?: typeof fetch;
}

const DEFAULT_API_BASE = "https://www.googleapis.com/calendar/v3";
const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function createFetchGoogleCalendarClient(config: FetchGoogleClientConfig): GoogleCalendarClient {
  const apiBase = config.apiBaseUrl ?? DEFAULT_API_BASE;
  const tokenUrl = config.tokenUrl ?? DEFAULT_TOKEN_URL;
  const doFetch = config.fetchImpl ?? fetch;

  return {
    async listEvents({ accessToken, calendarId, syncToken, pageToken }) {
      const url = new URL(`${apiBase}/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set("singleEvents", "false");
      if (syncToken) url.searchParams.set("syncToken", syncToken);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await doFetch(url.toString(), {
        headers: { authorization: `Bearer ${accessToken}` }
      });

      // 410 Gone: the syncToken is invalid. Signal a resync rather than throwing.
      if (response.status === 410) {
        return { gone: true };
      }
      if (!response.ok) {
        throw new Error(`Google events.list failed: ${response.status}`);
      }

      const body = (await response.json()) as {
        items?: RawGoogleEvent[];
        nextSyncToken?: string | null;
        nextPageToken?: string | null;
      };
      const result: ListEventsResult = {
        events: Array.isArray(body.items) ? body.items : [],
        nextSyncToken: body.nextSyncToken ?? null,
        nextPageToken: body.nextPageToken ?? null
      };
      return result;
    },

    async watch({ accessToken, calendarId, channelId, token, callbackUrl, ttlMs }) {
      const url = `${apiBase}/calendars/${encodeURIComponent(calendarId)}/events/watch`;
      const response = await doFetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: callbackUrl,
          token,
          expiration: String(Date.now() + ttlMs)
        })
      });
      if (!response.ok) {
        throw new Error(`Google events.watch failed: ${response.status}`);
      }
      const body = (await response.json()) as { id?: string; resourceId?: string; expiration?: string };
      const result: WatchResult = {
        channelId: body.id ?? channelId,
        resourceId: String(body.resourceId ?? ""),
        expiration: Number(body.expiration ?? Date.now() + ttlMs)
      };
      return result;
    },

    async stopChannel({ accessToken, channelId, resourceId }) {
      const response = await doFetch(`${apiBase}/channels/stop`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ id: channelId, resourceId })
      });
      // 404/410 on stop is fine — the channel is already gone.
      if (!response.ok && response.status !== 404 && response.status !== 410) {
        throw new Error(`Google channels.stop failed: ${response.status}`);
      }
    },

    async refreshToken({ refreshToken }) {
      const response = await doFetch(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        }).toString()
      });
      if (!response.ok) {
        throw new Error(`Google token refresh failed: ${response.status}`);
      }
      const body = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
        scope?: string | null;
        token_type?: string | null;
      };
      if (!body.access_token) {
        throw new Error("Google token refresh response missing access_token.");
      }
      const result: RefreshedToken = {
        accessToken: body.access_token,
        expiresInSeconds: Number(body.expires_in ?? 3600),
        scope: body.scope ?? null,
        tokenType: body.token_type ?? null
      };
      return result;
    }
  };
}
