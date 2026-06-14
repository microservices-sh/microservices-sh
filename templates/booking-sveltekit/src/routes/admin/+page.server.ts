import type { PageServerLoad } from "./$types";
import { listBookings } from "@microservices-sh/booking";
import { listCustomers } from "@microservices-sh/customer";

export const load: PageServerLoad = async ({ locals }) => {
  const [bookingsResult, customersResult] = await Promise.all([
    listBookings({ bookingRepository: locals.bookingRepository }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  return {
    bookings: bookingsResult.data.bookings.slice(0, 5),
    customers: customersResult.data.customers.slice(0, 5),
    counts: {
      bookings: bookingsResult.data.bookings.length,
      customers: customersResult.data.customers.length
    }
  };
};
