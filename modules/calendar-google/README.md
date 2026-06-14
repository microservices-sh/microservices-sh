# Google Calendar Module

Status: `available` (v0.1.0) · Class: `vertical` · Risk: `high`

Google Calendar sync for Cloudflare Workers + D1. It encapsulates the five things
AI agents reliably get wrong when wiring up Google Calendar:

1. **Single-flight OAuth refresh** — `refreshAccessToken` claims an atomic DB lease
   (`TokenStore.acquireRefreshLock`) so that when N workers all see an expired
   access token, exactly one calls Google and the rest reuse the stored result.
   No racing refreshes, no rotating-token invalidation.
2. **Watch-channel renewal** — Google push channels expire (~7 days). If nobody
   renews them, sync silently stops with no error. `renewExpiringChannels` finds
   channels in the renewal window and renews them (register-new-then-stop-old, so
   delivery never gaps). Drive it from a `jobs-workflows` schedule.
3. **Incremental sync + 410 resync** — `syncCalendar` pages with the stored
   `syncToken`. When Google invalidates the cursor it returns HTTP 410 Gone; the
   client surfaces that as `{ gone: true }`, and sync clears the token and
   full-resyncs (instead of wedging forever on an "error").
4. **Pure RRULE expansion** — `expandRecurrence()` in `src/rrule.ts` is a pure,
   deterministic function (UTC instants, no `Date.now`). Subset: `FREQ=DAILY |
   WEEKLY | MONTHLY`, `INTERVAL`, `COUNT`/`UNTIL`. MONTHLY clamps short months.
5. **Push + poll dedup** — `CalendarEventStore.upsert` returns
   `inserted | updated | duplicate` keyed on `(tenant, calendar, googleEventId)` +
   the `updated` marker; the change hook fires once. An event delivered via both a
   push notification and the next poll is processed exactly once.

All Google HTTP lives behind the `GoogleCalendarClient` port — the only file that
calls `fetch` is `src/adapters/fetch-google-client.ts`. Use cases are
framework-neutral and never import SvelteKit/Hono/`fetch`.

## Flow

```ts
import {
  connectCalendar, refreshAccessToken, syncCalendar, renewExpiringChannels,
  handlePushNotification, listEvents,
  createD1TokenStore, createD1SyncStateStore, createD1ChannelStore, createD1CalendarEventStore,
  createFetchGoogleCalendarClient
} from "@microservices-sh/calendar-google";

const tokenStore = createD1TokenStore(env.DB);
const syncStateStore = createD1SyncStateStore(env.DB);
const eventStore = createD1CalendarEventStore(env.DB);
const client = createFetchGoogleCalendarClient({ clientId: env.GOOGLE_ID, clientSecret: env.GOOGLE_SECRET });

await connectCalendar({ tenantId, refreshToken }, { tokenStore, syncStateStore });

// Keep the token fresh (single-flight), then sync.
const tok = await refreshAccessToken({ tenantId, calendarId: "primary", owner: crypto.randomUUID() }, { tokenStore, client });
await syncCalendar({ tenantId, calendarId: "primary" }, { accessToken: tok.data.accessToken, client, syncStateStore, eventStore });
```

## Recurrence expansion

```ts
import { expandRecurrence } from "@microservices-sh/calendar-google/rrule";

const instances = expandRecurrence(
  ["RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=10"],
  Date.parse("2026-06-15T09:00:00Z"),
  Date.parse("2026-06-15T10:00:00Z"),
  { windowStartMs: Date.parse("2026-06-15T00:00:00Z"), windowEndMs: Date.parse("2026-08-15T00:00:00Z") }
);
```

## Resources

- D1 (`DB`): `calendar_tokens`, `calendar_sync_state`, `calendar_channels`, `calendar_events` (migration `0001`).

## Verification

```bash
pnpm --filter @microservices-sh/calendar-google build
pnpm --filter @microservices-sh/calendar-google check:spec
```
