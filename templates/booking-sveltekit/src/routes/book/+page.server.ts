import type { PageServerLoad, Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createBooking, getBooking } from "@microservices-sh/booking";
import { createPaymentIntent } from "@microservices-sh/payment";
import { getCompanySettings } from "$lib/server/settings";
import { getAvailability } from "$lib/server/availability";
import { sendBookingConfirmation } from "$lib/server/notifications";
import { getPaymentDeps, depositCents, bookingRef } from "$lib/server/payment-deps";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  const date = url.searchParams.get("date") ?? today();
  const requestedService = url.searchParams.get("serviceId") ?? "svc-consultation";
  const services = await locals.bookingRepository.listServices();
  const service = services.find((s) => s.id === requestedService) ?? services[0];
  const serviceId = service?.id ?? requestedService;

  const settings = await getCompanySettings(platform?.env?.DB);
  const existing = await locals.bookingRepository.listBookings();

  const availability = await getAvailability({
    d1: platform?.env?.DB,
    serviceId,
    date,
    durationMinutes: service?.durationMinutes ?? 60,
    timezone: settings.timezone,
    bookings: existing.map((b) => ({
      serviceId: b.serviceId,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      status: b.status,
    })),
  });

  return { date, serviceId, services, availability, timezone: settings.timezone };
};

export const actions: Actions = {
  default: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const result = await createBooking(
      {
        serviceId: String(form.get("serviceId") ?? ""),
        startsAt: String(form.get("startsAt") ?? ""),
        customerName: String(form.get("customerName") ?? ""),
        customerEmail: String(form.get("customerEmail") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        notes: String(form.get("notes") ?? "")
      },
      {
        bookingRepository: locals.bookingRepository,
        customerRepository: locals.customerRepository,
        actor: locals.user
      }
    );

    if (!result.ok) {
      return fail(result.status, {
        error: result.error,
        values: Object.fromEntries(form.entries())
      });
    }

    // Confirmation email — best-effort; never block the booking on email.
    try {
      const settings = await getCompanySettings(platform?.env?.DB);
      const full = await getBooking({ id: result.data.booking.id }, { bookingRepository: locals.bookingRepository });
      if (full.ok) {
        await sendBookingConfirmation({
          d1: platform?.env?.DB,
          env: platform?.env,
          timezone: settings.timezone,
          booking: full.data.booking as never,
        });
      }
    } catch (error) {
      console.error("Booking confirmation email failed:", error);
    }

    // Deposit payment intent — best-effort; never block the booking.
    try {
      const settings = await getCompanySettings(platform?.env?.DB);
      if (settings.depositPercent > 0) {
        const service = await locals.bookingRepository.getService(result.data.booking.serviceId);
        const amount = depositCents(service?.priceCents ?? 0, settings.depositPercent);
        if (amount > 0) {
          await createPaymentIntent(
            {
              customerId: result.data.booking.customerId,
              amount,
              currency: (service?.currency ?? "usd").toLowerCase(),
              description: bookingRef(result.data.booking.id),
            },
            getPaymentDeps(platform?.env?.DB, platform?.env),
          );
        }
      }
    } catch (error) {
      console.error("Deposit payment intent failed:", error);
    }

    throw redirect(303, `/booking/${result.data.booking.id}`);
  }
};
