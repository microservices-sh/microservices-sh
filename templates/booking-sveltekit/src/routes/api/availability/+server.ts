import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getCompanySettings } from "$lib/server/settings";
import { getAvailability } from "$lib/server/availability";

// Availability JSON API — backed by the template availability engine (weekly
// rules + exceptions + buffers + timezone), conflict-checked against bookings.
export const GET: RequestHandler = async ({ url, locals, platform, getClientAddress }) => {
  // Rate-limit public availability reads per client IP (60 per minute).
  const ip = getClientAddress();
  const rl = await locals.rateLimitStore.hit("availability:" + ip, 60, 60);
  if (!rl.allowed) {
    return json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } }, { status: 429 });
  }

  const serviceId = url.searchParams.get("serviceId") ?? "";
  const date = url.searchParams.get("date") ?? "";
  if (!serviceId || !date) {
    return json({ ok: false, error: { code: "INVALID_QUERY", message: "serviceId and date are required." } }, { status: 400 });
  }

  const services = await locals.bookingRepository.listServices();
  const service = services.find((s) => s.id === serviceId);
  if (!service) {
    return json({ ok: false, error: { code: "SERVICE_NOT_FOUND", message: "Unknown service." } }, { status: 404 });
  }

  const settings = await getCompanySettings(platform?.env?.DB);
  const existing = await locals.bookingRepository.listBookings();

  const slots = await getAvailability({
    d1: platform?.env?.DB,
    serviceId,
    date,
    durationMinutes: service.durationMinutes,
    timezone: settings.timezone,
    bookings: existing.map((b) => ({ serviceId: b.serviceId, startsAt: b.startsAt, endsAt: b.endsAt, status: b.status })),
  });

  return json({ ok: true, data: { serviceId, date, timezone: settings.timezone, slots } });
};
