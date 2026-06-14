import { listEventsFilterSchema } from "../schemas";
import type { CalendarEventStore } from "../ports";

// Read the locally-cached, deduped events for a connection. Read model only — no
// Google call; syncCalendar populates the cache. Recurrence expansion for a
// display window is done with the pure expandRecurrence() in src/rrule.ts.
export async function listEvents(
  input: unknown,
  deps: { eventStore: CalendarEventStore }
) {
  const parsed = listEventsFilterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_LIST_INPUT", message: "List input is invalid.", issues: parsed.error.issues }
    };
  }

  const { tenantId, calendarId, limit } = parsed.data;
  const events = await deps.eventStore.list(tenantId, calendarId, limit);
  return { ok: true as const, status: 200 as const, data: { events, count: events.length } };
}
