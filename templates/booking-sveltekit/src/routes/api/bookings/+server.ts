import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { createBooking, listBookings } from "@microservices-sh/booking";
import { toSvelteKitResponse } from "$lib/server/adapters/sveltekit-response";

export const GET: RequestHandler = async ({ locals }) => {
  return toSvelteKitResponse(await listBookings({ bookingRepository: locals.bookingRepository }));
};

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
  // Rate-limit anonymous booking creation per client IP (10 per 10 minutes).
  const ip = getClientAddress();
  const rl = await locals.rateLimitStore.hit("api-book:" + ip, 10, 600);
  if (!rl.allowed) {
    return json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many booking attempts. Please try again later." } }, { status: 429 });
  }

  const result = await createBooking(await request.json(), {
    bookingRepository: locals.bookingRepository,
    customerRepository: locals.customerRepository,
    actor: locals.user
  });
  return toSvelteKitResponse(result);
};
