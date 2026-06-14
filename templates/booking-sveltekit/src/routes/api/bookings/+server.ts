import type { RequestHandler } from "./$types";
import { createBooking, listBookings } from "@microservices-sh/booking";
import { toSvelteKitResponse } from "$lib/server/adapters/sveltekit-response";

export const GET: RequestHandler = async ({ locals }) => {
  return toSvelteKitResponse(await listBookings({ bookingRepository: locals.bookingRepository }));
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const result = await createBooking(await request.json(), {
    bookingRepository: locals.bookingRepository,
    customerRepository: locals.customerRepository,
    actor: locals.user
  });
  return toSvelteKitResponse(result);
};
