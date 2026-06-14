import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { listBookings } from "@microservices-sh/booking";
import { getCustomer } from "@microservices-sh/customer";

export const load: PageServerLoad = async ({ params, locals }) => {
  const [customerResult, bookingsResult] = await Promise.all([
    getCustomer({ id: params.id }, { customerRepository: locals.customerRepository }),
    listBookings({ bookingRepository: locals.bookingRepository })
  ]);

  if (!customerResult.ok) {
    throw error(customerResult.status, "Customer not found");
  }

  return {
    customer: customerResult.data.customer,
    bookings: bookingsResult.data.bookings.filter((booking) => booking.customerId === params.id)
  };
};
