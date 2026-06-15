/* ─────────────────────────────────────────────────────────────────────────
   Dependency factory for the booking use cases.

   The booking use cases take their persistence ports as injected deps. This
   factory wires the standard adapters in one place — D1 when a database binding
   is present (production), an in-memory fallback otherwise (local dev / tests) —
   so route adapters and tests don't each re-implement the same selection.

   createBooking also needs the customer repository (it upserts the customer),
   so both repositories are returned together.
   ───────────────────────────────────────────────────────────────────────── */
import { createD1BookingRepository } from "./adapters/d1-booking-repository";
import { createMemoryBookingRepository } from "./adapters/memory-booking-repository";
import { createD1CustomerRepository } from "@microservices-sh/customer/adapters/d1";
import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";
import type { BookingRepository } from "./ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";

export interface BookingDeps {
  bookingRepository: BookingRepository;
  customerRepository: CustomerRepository;
}

// In-memory repositories are stateful; keep a singleton so state survives across
// calls within a process (e.g. a dev server handling multiple requests).
let memoryDeps: BookingDeps | null = null;

/**
 * Build the booking + customer repositories.
 *
 * @param env Optional environment. Pass `{ DB }` (a Cloudflare D1 binding) for
 *            production persistence; omit it to use the in-memory adapters.
 */
export function createBookingDeps(env?: { DB?: D1Database }): BookingDeps {
  if (env?.DB) {
    return {
      bookingRepository: createD1BookingRepository(env.DB),
      customerRepository: createD1CustomerRepository(env.DB),
    };
  }
  return (memoryDeps ??= {
    bookingRepository: createMemoryBookingRepository(),
    customerRepository: createMemoryCustomerRepository(),
  });
}
