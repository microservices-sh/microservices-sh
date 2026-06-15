import type { PageServerLoad, Actions } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { getBooking, cancelBooking } from "@microservices-sh/booking";
import { getCompanySettings } from "$lib/server/settings";
import { canCancel } from "$lib/server/lifecycle";
import { refundBookingDeposit } from "$lib/server/payment-deps";

export const load: PageServerLoad = async ({ params, locals, platform }) => {
  const result = await getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository });
  if (!result.ok) {
    throw error(result.status, "Booking not found");
  }
  const settings = await getCompanySettings(platform?.env?.DB);
  const decision = canCancel(result.data.booking.startsAt, settings, false);
  return {
    ...result.data,
    timezone: settings.timezone,
    cancel: { allowed: decision.allowed && result.data.booking.status !== "cancelled", reason: decision.reason },
  };
};

export const actions: Actions = {
  cancel: async ({ params, locals, platform }) => {
    const result = await getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository });
    if (!result.ok) return fail(404, { error: "Booking not found." });

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
