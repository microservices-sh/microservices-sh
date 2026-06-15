import { describe, it, expect } from "vitest";
import {
  expandRecurrence,
  parseInstantMs,
  refreshAccessToken,
  syncCalendar,
  applyEvents,
  createMemoryTokenStore,
  createMemorySyncStateStore,
  createMemoryCalendarEventStore,
  connectCalendar
} from "./index";
import type { GoogleCalendarClient, TokenStore } from "./ports";
import type { ListEventsResult, RawGoogleEvent, RefreshedToken } from "./types";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

// A configurable in-memory GoogleCalendarClient. Pages of listEvents results are
// dequeued in order; refreshToken counts calls so single-flight is observable.
function createFakeGoogleClient(opts: {
  pages?: Array<ListEventsResult | { gone: true }>;
  refresh?: RefreshedToken;
  onRefresh?: () => void;
} = {}): GoogleCalendarClient & { refreshCalls: number } {
  const pages = [...(opts.pages ?? [])];
  const client: GoogleCalendarClient & { refreshCalls: number } = {
    refreshCalls: 0,
    async listEvents() {
      if (pages.length === 0) return { events: [], nextSyncToken: "tok-empty" };
      return pages.shift()!;
    },
    async watch() {
      return { channelId: "chan-1", resourceId: "res-1", expiration: T0 + 604_800_000 };
    },
    async stopChannel() {
      // no-op
    },
    async refreshToken() {
      client.refreshCalls += 1;
      opts.onRefresh?.();
      return opts.refresh ?? { accessToken: "fresh-access", expiresInSeconds: 3600 };
    }
  };
  return client;
}

function rawEvent(over: Partial<RawGoogleEvent> & { id: string }): RawGoogleEvent {
  return {
    status: "confirmed",
    summary: "Event",
    start: { dateTime: "2026-01-02T09:00:00Z" },
    end: { dateTime: "2026-01-02T10:00:00Z" },
    updated: "2026-01-01T00:00:00Z",
    ...over
  };
}

describe("calendar-google: pure RRULE expansion", () => {
  const windowAll = { windowStartMs: T0, windowEndMs: T0 + 365 * 86_400_000 };

  it("FREQ=DAILY with INTERVAL and COUNT", () => {
    const start = Date.parse("2026-01-01T09:00:00Z");
    const end = start + 3_600_000;
    const out = expandRecurrence(["RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3"], start, end, windowAll);
    expect(out.map((i) => i.startAt)).toEqual([
      "2026-01-01T09:00:00.000Z",
      "2026-01-03T09:00:00.000Z",
      "2026-01-05T09:00:00.000Z"
    ]);
    // Duration preserved on each instance.
    expect(out[0].endAt).toBe("2026-01-01T10:00:00.000Z");
  });

  it("FREQ=WEEKLY with UNTIL bound (inclusive)", () => {
    const start = Date.parse("2026-01-01T09:00:00Z"); // Thursday
    const out = expandRecurrence(
      ["RRULE:FREQ=WEEKLY;UNTIL=20260115T090000Z"],
      start,
      start + 3_600_000,
      windowAll
    );
    expect(out.map((i) => i.startAt)).toEqual([
      "2026-01-01T09:00:00.000Z",
      "2026-01-08T09:00:00.000Z",
      "2026-01-15T09:00:00.000Z"
    ]);
  });

  it("FREQ=MONTHLY clamps short months (Jan 31 -> Feb 28)", () => {
    const start = Date.parse("2026-01-31T12:00:00Z");
    const out = expandRecurrence(["RRULE:FREQ=MONTHLY;COUNT=4"], start, start + 3_600_000, windowAll);
    expect(out.map((i) => i.startAt)).toEqual([
      "2026-01-31T12:00:00.000Z",
      "2026-02-28T12:00:00.000Z", // 2026 is not a leap year -> clamped to 28
      "2026-03-31T12:00:00.000Z",
      "2026-04-30T12:00:00.000Z" // April has 30 days -> clamped
    ]);
  });

  it("non-recurring rule yields a single window-filtered instance", () => {
    const start = Date.parse("2026-01-05T09:00:00Z");
    const out = expandRecurrence([], start, start + 3_600_000, windowAll);
    expect(out).toHaveLength(1);
    expect(out[0].startAt).toBe("2026-01-05T09:00:00.000Z");
  });

  it("parseInstantMs handles iCal basic, RFC3339, and bare date forms", () => {
    expect(parseInstantMs("20260615T090000Z")).toBe(Date.UTC(2026, 5, 15, 9, 0, 0));
    expect(parseInstantMs("2026-06-15")).toBe(Date.UTC(2026, 5, 15, 0, 0, 0));
    expect(parseInstantMs("not-a-date")).toBeNull();
  });
});

describe("calendar-google: single-flight OAuth refresh lock", () => {
  async function seedExpiredToken(tokenStore: TokenStore) {
    await connectCalendar(
      {
        tenantId: "tenant-1",
        calendarId: "primary",
        refreshToken: "refresh-1",
        accessToken: "stale",
        accessTokenExpiresAt: T0 - 1000 // already expired
      },
      { tokenStore, syncStateStore: createMemorySyncStateStore(), now: fixedNow(T0) }
    );
  }

  it("only one contender calls Google when two refresh concurrently", async () => {
    const tokenStore = createMemoryTokenStore();
    await seedExpiredToken(tokenStore);

    const client = createFakeGoogleClient({ refresh: { accessToken: "fresh", expiresInSeconds: 3600 } });
    // No real sleeping: the loser's wait re-reads the store (which the winner has
    // already written) and reuses the fresh token without calling Google.
    const sleep = async () => {};

    const [a, b] = await Promise.all([
      refreshAccessToken(
        { tenantId: "tenant-1", calendarId: "primary", owner: "worker-A" },
        { tokenStore, client, now: fixedNow(T0), sleep }
      ),
      refreshAccessToken(
        { tenantId: "tenant-1", calendarId: "primary", owner: "worker-B" },
        { tokenStore, client, now: fixedNow(T0), sleep }
      )
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Exactly one network refresh happened despite two contenders.
    expect(client.refreshCalls).toBe(1);
    // Exactly one of them did the real refresh; the other reused the result.
    const refreshedFlags = [
      a.ok ? a.data.refreshed : undefined,
      b.ok ? b.data.refreshed : undefined
    ].filter((x) => x === true);
    expect(refreshedFlags).toHaveLength(1);
  });

  it("reuses a still-valid access token without acquiring the lock", async () => {
    const tokenStore = createMemoryTokenStore();
    await connectCalendar(
      {
        tenantId: "tenant-1",
        calendarId: "primary",
        refreshToken: "refresh-1",
        accessToken: "valid",
        accessTokenExpiresAt: T0 + 3_600_000
      },
      { tokenStore, syncStateStore: createMemorySyncStateStore(), now: fixedNow(T0) }
    );
    const client = createFakeGoogleClient();
    const res = await refreshAccessToken(
      { tenantId: "tenant-1", calendarId: "primary", owner: "worker-A" },
      { tokenStore, client, now: fixedNow(T0) }
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.refreshed).toBe(false);
    expect(client.refreshCalls).toBe(0);
  });
});

describe("calendar-google: incremental sync 410 gone -> clears cursor + full resync", () => {
  it("drops the dead syncToken, bumps resyncCount, and stores the fresh cursor", async () => {
    const syncStateStore = createMemorySyncStateStore();
    const eventStore = createMemoryCalendarEventStore();

    // Seed an existing cursor so the first listEvents is an incremental pull.
    await syncStateStore.upsert({
      id: "syn_seed",
      tenantId: "tenant-1",
      calendarId: "primary",
      syncToken: "stale-cursor",
      lastSyncedAt: new Date(T0 - 86_400_000).toISOString(),
      resyncCount: 0,
      createdAt: new Date(T0 - 86_400_000).toISOString(),
      updatedAt: new Date(T0 - 86_400_000).toISOString()
    });

    // First page: 410 Gone. After clearing, the full resync returns one event + a
    // fresh nextSyncToken.
    const client = createFakeGoogleClient({
      pages: [
        { gone: true },
        { events: [rawEvent({ id: "g-1" })], nextSyncToken: "fresh-cursor" }
      ]
    });

    const res = await syncCalendar(
      { tenantId: "tenant-1", calendarId: "primary" },
      { accessToken: "valid-access", client, syncStateStore, eventStore, now: fixedNow(T0) }
    );

    expect(res.ok).toBe(true);
    if (res.ok && "didResync" in res.data) {
      expect(res.data.didResync).toBe(true);
      expect(res.data.resyncCount).toBe(1);
      expect(res.data.inserted).toBe(1);
    }

    const state = await syncStateStore.get("tenant-1", "primary");
    expect(state?.syncToken).toBe("fresh-cursor");
  });
});

describe("calendar-google: push+poll upsert dedups same googleEventId", () => {
  it("the same event with an unchanged `updated` marker is deduped, not re-inserted", async () => {
    const eventStore = createMemoryCalendarEventStore();
    const raw = rawEvent({ id: "g-42", updated: "2026-01-01T05:00:00Z" });

    // First delivery (e.g. via poll).
    const first = await applyEvents([raw], { eventStore, now: fixedNow(T0) }, { tenantId: "tenant-1", calendarId: "primary" });
    expect(first).toMatchObject({ inserted: 1, updated: 0, deduped: 0 });

    // Second delivery of the SAME event (e.g. via push) — identical updated marker.
    const second = await applyEvents([raw], { eventStore, now: fixedNow(T0 + 1) }, { tenantId: "tenant-1", calendarId: "primary" });
    expect(second).toMatchObject({ inserted: 0, updated: 0, deduped: 1 });

    // A genuine change (new updated marker) counts as an update, not a dup.
    const changed = rawEvent({ id: "g-42", updated: "2026-01-02T05:00:00Z", summary: "Renamed" });
    const third = await applyEvents([changed], { eventStore, now: fixedNow(T0 + 2) }, { tenantId: "tenant-1", calendarId: "primary" });
    expect(third).toMatchObject({ inserted: 0, updated: 1, deduped: 0 });

    // Still only one stored row for that googleEventId.
    const stored = await eventStore.get("tenant-1", "primary", "g-42");
    expect(stored?.summary).toBe("Renamed");
  });
});
