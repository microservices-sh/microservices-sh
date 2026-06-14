import type { PageServerLoad } from "./$types";
import { listBookings } from "@microservices-sh/booking";

export const load: PageServerLoad = async ({ locals }) => {
  const result = await listBookings({ bookingRepository: locals.bookingRepository });
  return {
    bookings: result.data.bookings
  };
};
