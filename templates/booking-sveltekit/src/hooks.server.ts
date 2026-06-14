import type { Handle } from "@sveltejs/kit";
import { createD1BookingRepository } from "@microservices-sh/booking/adapters/d1";
import { createMemoryBookingRepository } from "@microservices-sh/booking/adapters/memory";
import { createD1CustomerRepository } from "@microservices-sh/customer/adapters/d1";
import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";

const memoryBookingRepository = createMemoryBookingRepository();
const memoryCustomerRepository = createMemoryCustomerRepository();

export const handle: Handle = async ({ event, resolve }) => {
  const db = event.platform?.env?.DB;
  event.locals.bookingRepository = db ? createD1BookingRepository(db) : memoryBookingRepository;
  event.locals.customerRepository = db ? createD1CustomerRepository(db) : memoryCustomerRepository;

  event.locals.user = {
    id: "local-admin",
    email: "admin@example.com",
    isAdmin: true
  };

  return resolve(event);
};
