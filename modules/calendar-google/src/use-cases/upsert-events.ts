import { onCalendarEventUpserted } from "../hooks";
import type { CalendarEventStore } from "../ports";
import type { CalendarEvent, RawGoogleEvent } from "../types";

function normalizeStatus(value: string | null | undefined): CalendarEvent["status"] {
  if (value === "tentative") return "tentative";
  if (value === "cancelled") return "cancelled";
  return "confirmed";
}

function instant(slot: { dateTime?: string | null; date?: string | null } | null | undefined): string | null {
  if (!slot) return null;
  return slot.dateTime ?? slot.date ?? null;
}

// Map a raw Google event to our cached row.
export function toCalendarEvent(
  raw: RawGoogleEvent,
  ctx: { tenantId: string; calendarId: string; nowIso: string }
): CalendarEvent {
  return {
    id: "evt_" + crypto.randomUUID().slice(0, 16),
    tenantId: ctx.tenantId,
    calendarId: ctx.calendarId,
    googleEventId: raw.id,
    etag: raw.etag ?? null,
    status: normalizeStatus(raw.status),
    summary: raw.summary ?? null,
    startAt: instant(raw.start),
    endAt: instant(raw.end),
    recurrence: Array.isArray(raw.recurrence) ? raw.recurrence : null,
    recurringEventId: raw.recurringEventId ?? null,
    updated: raw.updated ?? null,
    raw: raw as Record<string, unknown>,
    createdAt: ctx.nowIso,
    updatedAt: ctx.nowIso
  };
}

// Apply a batch of raw events through the deduped store. The store decides
// inserted/updated/duplicate by (tenant, calendar, googleEventId) + the `updated`
// marker; the change hook fires ONLY for real changes — this is the push+poll
// dedup boundary, so an event seen via both a push notification and a poll is
// processed exactly once.
export async function applyEvents(
  rawEvents: RawGoogleEvent[],
  deps: { eventStore: CalendarEventStore; now?: () => number },
  ctx: { tenantId: string; calendarId: string }
): Promise<{ inserted: number; updated: number; deduped: number }> {
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  let inserted = 0;
  let updated = 0;
  let deduped = 0;

  for (const raw of rawEvents) {
    if (!raw || typeof raw.id !== "string" || raw.id.length === 0) continue;
    const event = toCalendarEvent(raw, { tenantId: ctx.tenantId, calendarId: ctx.calendarId, nowIso });
    const result = await deps.eventStore.upsert(event);
    if (result === "duplicate") {
      deduped += 1;
      continue;
    }
    if (result === "inserted") inserted += 1;
    else updated += 1;
    await onCalendarEventUpserted(event);
  }

  return { inserted, updated, deduped };
}
