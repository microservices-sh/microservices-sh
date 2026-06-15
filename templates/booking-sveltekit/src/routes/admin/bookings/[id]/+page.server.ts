import type { PageServerLoad, Actions } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { getBooking, cancelBooking, createBooking } from "@microservices-sh/booking";
import { getCompanySettings } from "$lib/server/settings";
import { getAvailability } from "$lib/server/availability";

export const load: PageServerLoad = async ({ params, locals, url, platform }) => {
  const result = await getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository });
  if (!result.ok) {
    throw error(result.status, "Booking not found");
  }
  const booking = result.data.booking;
  const settings = await getCompanySettings(platform?.env?.DB);

  // When a reschedule date is chosen, surface that day's open slots.
  const rescheduleDate = url.searchParams.get("date");
  let rescheduleSlots: { startsAt: string; available: boolean }[] = [];
  if (rescheduleDate) {
    const services = await locals.bookingRepository.listServices();
    const service = services.find((s) => s.id === booking.serviceId);
    const existing = await locals.bookingRepository.listBookings();
    rescheduleSlots = await getAvailability({
      d1: platform?.env?.DB,
      serviceId: booking.serviceId,
      date: rescheduleDate,
      durationMinutes: service?.durationMinutes ?? 60,
      timezone: settings.timezone,
      bookings: existing.map((b) => ({ serviceId: b.serviceId, startsAt: b.startsAt, endsAt: b.endsAt, status: b.status })),
    });
  }

  return { ...result.data, timezone: settings.timezone, rescheduleDate, rescheduleSlots };
};

export const actions: Actions = {
  // Admin cancel — bypasses the customer notice-window policy.
  cancel: async ({ params, locals }) => {
    const res = await cancelBooking(
      { id: params.id, reason: "admin" },
      { bookingRepository: locals.bookingRepository, actor: locals.user },
    );
    if (!res.ok) return fail(res.status, { error: res.error.message });
    return { cancelled: true };
  },

  // Reschedule = book the new slot (validates availability), then cancel the old.
  reschedule: async ({ params, request, locals }) => {
    const formData = await request.formData();
    const newStartsAt = String(formData.get("startsAt") ?? "");
    if (!newStartsAt) return fail(400, { error: "Pick a new time first." });

    const current = await getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository });
    if (!current.ok) return fail(404, { error: "Booking not found." });
    const b = current.data.booking as {
      serviceId: string;
      customerId: string;
      customerName: string;
      customerEmail: string;
      notes?: string;
    };

    const customer = await locals.customerRepository.getCustomer(b.customerId);

    const created = await createBooking(
      {
        serviceId: b.serviceId,
        startsAt: newStartsAt,
        customerName: b.customerName,
        customerEmail: b.customerEmail,
        customerPhone: customer?.phone ?? "",
        notes: b.notes ?? "",
      },
      { bookingRepository: locals.bookingRepository, customerRepository: locals.customerRepository, actor: locals.user },
    );
    if (!created.ok) return fail(created.status, { error: created.error.message });

    await cancelBooking(
      { id: params.id, reason: "rescheduled" },
      { bookingRepository: locals.bookingRepository, actor: locals.user },
    );
    throw redirect(303, `/admin/bookings/${created.data.booking.id}`);
  },
};
