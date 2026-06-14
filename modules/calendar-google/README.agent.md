# Agent Guide: Google Calendar Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, app route code,
   or call `fetch` in use cases. ALL Google HTTP lives behind the
   `GoogleCalendarClient` port; the only file that may call `fetch` is
   `src/adapters/fetch-google-client.ts`.
2. Put persistence behind `TokenStore` / `SyncStateStore` / `ChannelStore` /
   `CalendarEventStore`. Never make real I/O in tests — use the `createMemory*`
   adapters and a fake `GoogleCalendarClient`.
3. Preserve the five correctness invariants; they are the reason this module exists:
   - **Single-flight refresh**: `refreshAccessToken` must claim
     `TokenStore.acquireRefreshLock` before calling Google; non-winners wait and
     reuse the stored token. Never refresh on every caller.
   - **Channel renewal**: `renewExpiringChannels` renews channels in the renewal
     window via register-new-then-stop-old (no delivery gap). Never let channels
     lapse silently.
   - **410 resync**: `syncCalendar` must treat the client's `{ gone: true }`
     (HTTP 410) as a cursor invalidation and full-resync, not as a fatal error.
   - **Pure recurrence**: `src/rrule.ts` stays pure and deterministic (no `Date.now`,
     no I/O). Expand within the window; honor COUNT/UNTIL; ignore unsupported parts
     rather than guessing.
   - **Push+poll dedup**: `CalendarEventStore.upsert` returns
     inserted/updated/duplicate; the change hook fires once per real change. A push
     is a hint only — fetch event data via sync, not from the push body.
4. OAuth client id/secret and channel callback URLs are injected — never hard-code
   secrets. Refresh tokens are sensitive; treat them as such.
5. Risk `high`: migrations, OAuth secret handling, external side effects, and
   production deploy are approval-gated.
6. Run `pnpm --filter @microservices-sh/calendar-google build` and `check:spec`
   after edits.
