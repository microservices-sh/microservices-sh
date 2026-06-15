import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getCompanySettings } from "$lib/server/settings";
import { expireHolds } from "$lib/server/lifecycle";
import { sendDueReminders } from "$lib/server/notifications";
import { requireCronAuth } from "$lib/server/cron-auth";

// Scheduled work entrypoint: expire stale holds + send due booking reminders.
// Requires CRON_TOKEN (fail-closed). Invoke from a Cloudflare Cron Trigger via a
// scheduled() worker wrapper (see docs/cron.md) or any external scheduler.
// Idempotent: reminders are de-duped via booking_reminders.
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const denied = requireCronAuth(request, platform?.env?.CRON_TOKEN);
  if (denied) return denied;

  const db = platform?.env?.DB;
  const settings = await getCompanySettings(db);
  const expired = db ? await expireHolds(db) : 0;

  const bookings = await locals.bookingRepository.listBookings();
  const reminders = await sendDueReminders({
    d1: db,
    env: platform?.env,
    timezone: settings.timezone,
    reminderHours: settings.reminderHours,
    bookings: bookings as never,
  });

  return json({ ok: true, data: { holdsExpired: expired, reminders } });
};
