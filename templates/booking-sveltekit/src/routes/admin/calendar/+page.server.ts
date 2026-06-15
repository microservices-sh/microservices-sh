import type { PageServerLoad } from "./$types";
import { listBookings } from "@microservices-sh/booking";
import { getCompanySettings } from "$lib/server/settings";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return isoDate(d);
}

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  const settings = await getCompanySettings(platform?.env?.DB);
  const tz = settings.timezone;
  const start = mondayOf(url.searchParams.get("start") ?? new Date().toISOString().slice(0, 10));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const result = await listBookings({ bookingRepository: locals.bookingRepository });

  // Group bookings by their calendar date in the company timezone.
  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(iso),
    );

  const byDay: Record<string, typeof result.data.bookings> = {};
  for (const d of days) byDay[d] = [];
  for (const b of result.data.bookings) {
    const k = dayKey(b.startsAt);
    if (k in byDay) byDay[k].push(b);
  }
  for (const d of days) byDay[d].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));

  return { start, days, byDay, timezone: tz, prev: addDays(start, -7), next: addDays(start, 7) };
};
