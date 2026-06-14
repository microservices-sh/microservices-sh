import type { PageServerLoad, Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createBooking, getAvailability } from "@microservices-sh/booking";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const date = url.searchParams.get("date") ?? today();
  const serviceId = url.searchParams.get("serviceId") ?? "svc-consultation";
  const services = await locals.bookingRepository.listServices();
  const availability = await getAvailability(
    { serviceId, date },
    { bookingRepository: locals.bookingRepository }
  );

  return {
    date,
    serviceId,
    services,
    availability: availability.ok ? availability.data.slots : []
  };
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
