// Availability engine (revamp P1).
//
// Template-owned (boundary A): generates bookable slots from weekly rules −
// date exceptions − existing bookings, with buffers, computed in the company
// timezone (DST-correct via date-fns-tz). The booking MODULE still validates +
// persists via createBooking; this only decides which slots to offer.
import { and, eq, isNull, or } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";
import { getDb } from "./db";
import { availabilityRules, availabilityExceptions, type AvailabilityRule, type AvailabilityException } from "./db/schema";

export interface Slot {
  startsAt: string; // ISO UTC
  endsAt: string; // ISO UTC
  available: boolean;
}

export interface ExistingBooking {
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

type Window = { startTime: string; endTime: string; bufferMinutes: number };

// Mon–Fri 09:00–17:00 — used when no D1 is bound (local in-memory dev).
const DEFAULT_RULES: Window[] = [1, 2, 3, 4, 5].map(() => ({ startTime: "09:00", endTime: "17:00", bufferMinutes: 0 }));

const BLOCKING_STATUSES = new Set(["confirmed", "pending", "hold"]);

function weekday(date: string): number {
  // Day-of-week of the calendar date (timezone-independent); noon avoids edges.
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function toUtc(date: string, time: string, timezone: string): Date {
  return fromZonedTime(`${date}T${time}:00`, timezone);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Pure slot generator — no I/O, easy to unit test.
 */
export function generateSlots(opts: {
  date: string;
  timezone: string;
  durationMinutes: number;
  rules: Window[];
  exceptions: { type: string; startTime: string | null; endTime: string | null }[];
  bookings: ExistingBooking[];
}): Slot[] {
  const { date, timezone, durationMinutes, rules, exceptions, bookings } = opts;

  // A closed exception wins — no slots that day.
  if (exceptions.some((e) => e.type === "closed")) return [];

  // special_hours override the weekly rules when present.
  const special = exceptions.filter((e) => e.type === "special_hours" && e.startTime && e.endTime);
  const windows: Window[] = special.length
    ? special.map((e) => ({ startTime: e.startTime as string, endTime: e.endTime as string, bufferMinutes: 0 }))
    : rules;

  const stepMs = durationMinutes * 60_000;
  const slots: Slot[] = [];

  for (const w of windows) {
    const windowEnd = toUtc(date, w.endTime, timezone).getTime();
    let cursor = toUtc(date, w.startTime, timezone).getTime();
    const bufferMs = (w.bufferMinutes ?? 0) * 60_000;

    while (cursor + stepMs <= windowEnd) {
      const startsAt = new Date(cursor).toISOString();
      const endsAt = new Date(cursor + stepMs).toISOString();
      const conflict = bookings.some(
        (b) => BLOCKING_STATUSES.has(b.status) && overlaps(b.startsAt, b.endsAt, startsAt, endsAt),
      );
      slots.push({ startsAt, endsAt, available: !conflict });
      cursor = cursor + stepMs + bufferMs;
    }
  }

  return slots.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}

async function loadConfig(
  d1: D1Database | undefined,
  serviceId: string,
  date: string,
): Promise<{ rules: Window[]; exceptions: AvailabilityException[] }> {
  if (!d1) {
    return { rules: DEFAULT_RULES, exceptions: [] };
  }
  const db = getDb(d1);
  const dow = weekday(date);
  const forService = (col: typeof availabilityRules.serviceId | typeof availabilityExceptions.serviceId) =>
    or(isNull(col), eq(col, serviceId));

  const [ruleRows, exceptionRows]: [AvailabilityRule[], AvailabilityException[]] = await Promise.all([
    db
      .select()
      .from(availabilityRules)
      .where(and(eq(availabilityRules.active, true), eq(availabilityRules.dayOfWeek, dow), forService(availabilityRules.serviceId)))
      .all(),
    db
      .select()
      .from(availabilityExceptions)
      .where(and(eq(availabilityExceptions.date, date), forService(availabilityExceptions.serviceId)))
      .all(),
  ]);

  const rules: Window[] = ruleRows.map((r) => ({ startTime: r.startTime, endTime: r.endTime, bufferMinutes: r.bufferMinutes }));
  return { rules, exceptions: exceptionRows };
}

/**
 * Orchestrator: load rules/exceptions (Drizzle or offline defaults) and generate
 * slots, marking conflicts against the supplied existing bookings.
 */
export async function getAvailability(opts: {
  d1: D1Database | undefined;
  serviceId: string;
  date: string;
  durationMinutes: number;
  timezone: string;
  bookings: ExistingBooking[];
}): Promise<Slot[]> {
  const { d1, serviceId, date, durationMinutes, timezone, bookings } = opts;
  const { rules, exceptions } = await loadConfig(d1, serviceId, date);
  const sameService = bookings.filter((b) => b.serviceId === serviceId);
  return generateSlots({ date, timezone, durationMinutes, rules, exceptions, bookings: sameService });
}
