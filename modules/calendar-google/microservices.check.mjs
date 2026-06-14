export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_calendar_google.sql",
    "CREATE TABLE IF NOT EXISTS calendar_tokens",
    "Calendar-google migration owns the calendar_tokens table."
  );
  assertFileIncludes(
    "migrations/0001_calendar_google.sql",
    "idx_calendar_events_event",
    "Push+poll dedup is enforced by a unique index on (tenant, calendar, google_event_id)."
  );
  assertFileIncludes(
    "src/rrule.ts",
    "export function expandRecurrence",
    "Recurring-event RRULE expansion is a pure function in src/rrule.ts."
  );
  assertFileIncludes(
    "src/use-cases/refresh-access-token.ts",
    "acquireRefreshLock",
    "Token refresh is single-flight: concurrent refreshes are serialized by a lock, not raced."
  );
  assertFileIncludes(
    "src/use-cases/sync-calendar.ts",
    "gone",
    "Sync falls back to a full resync when Google invalidates the syncToken (410 Gone)."
  );
  assertFileIncludes(
    "src/use-cases/renew-expiring-channels.ts",
    "listExpiring",
    "Watch channels are renewed before the ~7-day expiry so sync does not silently stop."
  );
  assertFileIncludes(
    "src/ports/index.ts",
    "GoogleCalendarClient",
    "Google HTTP calls live behind an injected GoogleCalendarClient port, never fetch in use cases."
  );
}
