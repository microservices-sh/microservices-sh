import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import { createMemoryBookingRepository } from "../../src/adapters/memory-booking-repository";
import type { BookingRepository, Clock, IdGenerator } from "../../src/ports";
import type { Actor } from "../../src/types";

/**
 * Deterministic clock + id generator so use-case responses
 * (generatedAt, idStrategy) are assertable without touching wall-clock time.
 */
export const FIXED_NOW = new Date("2026-06-14T00:00:00.000Z");

export const fixedClock: Clock = {
  now: () => FIXED_NOW
};

export const fixedIdGenerator: IdGenerator = {
  create: (prefix) => `${prefix}_fixed`
};

export interface BookingDeps {
  bookingRepository: BookingRepository;
  customerRepository: CustomerRepository;
  actor?: Actor | null;
  clock?: Clock;
  idGenerator?: IdGenerator;
}

export function makeDeps(overrides: Partial<BookingDeps> = {}): BookingDeps {
  return {
    bookingRepository: createMemoryBookingRepository(),
    customerRepository: createMemoryCustomerRepository(),
    actor: { id: "act_admin", email: "admin@example.com", isAdmin: true },
    clock: fixedClock,
    idGenerator: fixedIdGenerator,
    ...overrides
  };
}

/**
 * Minimal valid create-booking payload. `svc-consultation` is a 60-minute
 * active service seeded by the in-memory repository.
 */
export function validBookingInput(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: "svc-consultation",
    startsAt: "2026-07-01T09:00:00.000Z",
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    customerPhone: "+15551234567",
    notes: "First visit",
    ...overrides
  };
}
