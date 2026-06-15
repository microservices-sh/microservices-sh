import type { PageServerLoad } from "./$types";
import { listBookings } from "@microservices-sh/booking";
import { getCompanySettings } from "$lib/server/settings";

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  const settings = await getCompanySettings(platform?.env?.DB);
  const result = await listBookings({ bookingRepository: locals.bookingRepository });

  const status = url.searchParams.get("status") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  let bookings = result.data.bookings;
  if (status) bookings = bookings.filter((b) => b.status === status);
  if (q) bookings = bookings.filter((b) => `${b.customerName} ${b.serviceName}`.toLowerCase().includes(q));

  const statuses = Array.from(new Set(result.data.bookings.map((b) => b.status))).sort();

  return { bookings, status, q, statuses, total: result.data.bookings.length, timezone: settings.timezone };
};
