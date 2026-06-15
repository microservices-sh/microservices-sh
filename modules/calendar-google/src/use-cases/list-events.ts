import { ok, err } from "@microservices-sh/connection-contract";
import { listEventsFilterSchema } from "../schemas";
import { calendarGoogleMeta } from "../meta";
import type { CalendarEventStore } from "../ports";

// Read the locally-cached, deduped events for a connection. Read model only — no
// Google call; syncCalendar populates the cache. Recurrence expansion for a
// display window is done with the pure expandRecurrence() in src/rrule.ts.
export async function listEvents(
  input: unknown,
  deps: { eventStore: CalendarEventStore; now?: () => number; correlationId?: string }
) {
  const meta = calendarGoogleMeta(deps);

  const parsed = listEventsFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "calendar-google.INVALID_LIST_INPUT", message: "List input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const { tenantId, calendarId, limit } = parsed.data;
  const events = await deps.eventStore.list(tenantId, calendarId, limit);
  return ok(200, { events, count: events.length }, meta);
}
