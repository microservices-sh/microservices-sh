import type { PageServerLoad, Actions } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { getBooking, cancelBooking } from "@microservices-sh/booking";
import { getCompanySettings } from "$lib/server/settings";
import { canCancel } from "$lib/server/lifecycle";
import { canAccessBooking } from "$lib/server/booking-access";
import { refundBookingDeposit } from "$lib/server/payment-deps";

export const load: PageServerLoad = async ({ params, locals, platform, url }) => {
  // Access token carried in the post-booking redirect (?t=...). Admins bypass it.
  const token = url.searchParams.get("t") ?? "";
  const result = await getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository });
  if (!result.ok) {
    throw error(result.status, "Booking not found");
  }
  // FIX C2: gate access (admin session OR constant-time token match). On failure
  // return 404 to hide the booking's existence (same as the not-found path).
  if (!canAccessBooking(locals.user, result.data.booking.accessToken, token)) {
    throw error(404, "Booking not found");
  }

  const settings = await getCompanySettings(platform?.env?.DB);
  const decision = canCancel(result.data.booking.startsAt, settings, false);
  // Strip the secret token from the booking before it reaches the client; the
  // cancel form carries it via `manageToken` instead.
  const { accessToken: _accessToken, ...booking } = result.data.booking;
  return {
    booking,
    timezone: settings.timezone,
    manageToken: token,
    cancel: { allowed: decision.allowed && result.data.booking.status !== "cancelled", reason: decision.reason },
  };
};

export const actions: Actions = {
  cancel: async ({ params, locals, platform, request }) => {
    // Query string is dropped on the action POST, so the token comes from the form.
    const token = String((await request.formData()).get("t") ?? "");
    const result = await getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository });
    if (!result.ok) return fail(404, { error: "Booking not found." });

    // FIX C2: same allow check as load BEFORE cancelling/refunding.
    if (!canAccessBooking(locals.user, result.data.booking.accessToken, token)) {
      return fail(404, { error: "Booking not found." });
    }

    const settings = await getCompanySettings(platform?.env?.DB);
    const decision = canCancel(result.data.booking.startsAt, settings, false);
    if (!decision.allowed) return fail(403, { error: decision.reason ?? "Cancellation not allowed." });

    const cancelled = await cancelBooking(
      { id: params.id, reason: "customer" },
      { bookingRepository: locals.bookingRepository, actor: locals.user },
    );
    if (!cancelled.ok) return fail(cancelled.status, { error: cancelled.error.message });

    await refundBookingDeposit(platform?.env?.DB, platform?.env, result.data.booking.customerId, params.id);
    return { cancelled: true };
  },
};
