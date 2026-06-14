import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getBooking } from "@microservices-sh/booking";

export const load: PageServerLoad = async ({ params, locals }) => {
  const result = await getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository });
  if (!result.ok) {
    throw error(result.status, "Booking not found");
  }
  return result.data;
};
