import type { PageServerLoad, Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createBooking } from "@microservices-sh/booking";
import { getCompanySettings } from "$lib/server/settings";
import { getAvailability } from "$lib/server/availability";

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
  default: async ({ request, locals }) => {
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

    throw redirect(303, `/booking/${result.data.booking.id}`);
  }
};
