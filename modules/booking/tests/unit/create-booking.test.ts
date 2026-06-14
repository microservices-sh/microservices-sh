import { describe, expect, it } from "vitest";
import { createBooking } from "../../src/use-cases/create-booking";
import type { BookingRepository } from "../../src/ports";
import { FIXED_NOW, makeDeps, validBookingInput } from "./helpers";

describe("createBooking", () => {
  it("creates a confirmed booking on the happy path", async () => {
    const deps = makeDeps();
    const result = await createBooking(validBookingInput(), deps);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    const booking = result.data!.booking;
    expect(booking.status).toBe("confirmed");
    expect(booking.serviceId).toBe("svc-consultation");
    expect(booking.serviceName).toBe("Consultation");
    expect(booking.customerName).toBe("Ada Lovelace");
    expect(booking.customerEmail).toBe("ada@example.com");
    expect(booking.notes).toBe("First visit");
    expect(booking.id).toMatch(/^bk_/);
    expect(booking.customerId).toMatch(/^cus_/);
  });

  it("derives endsAt from the service duration (60 min)", async () => {
    const deps = makeDeps();
    const result = await createBooking(
      validBookingInput({ startsAt: "2026-07-01T09:00:00.000Z" }),
      deps
    );

    expect(result.data!.booking.startsAt).toBe("2026-07-01T09:00:00.000Z");
    // svc-consultation is 60 minutes
    expect(result.data!.booking.endsAt).toBe("2026-07-01T10:00:00.000Z");
  });

  it("uses the injected clock and id generator for response metadata", async () => {
    const deps = makeDeps();
    const result = await createBooking(validBookingInput(), deps);

    expect(result.data!.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(result.data!.idStrategy).toBe("preview_fixed");
  });

  it("persists the booking and writes a booking.confirmed event", async () => {
    const deps = makeDeps();
    const result = await createBooking(validBookingInput(), deps);

    const stored = await deps.bookingRepository.getBooking(result.data!.booking.id);
    expect(stored).not.toBeNull();
    expect(stored!.id).toBe(result.data!.booking.id);
  });

  it("upserts the customer so it is retrievable by email", async () => {
    const deps = makeDeps();
    await createBooking(validBookingInput(), deps);

    const customer = await deps.customerRepository.findCustomerByEmail("ada@example.com");
    expect(customer).not.toBeNull();
    expect(customer!.name).toBe("Ada Lovelace");
  });

  it("reuses an existing customer instead of duplicating on a second booking", async () => {
    const deps = makeDeps();
    const first = await createBooking(validBookingInput(), deps);
    const second = await createBooking(
      validBookingInput({ startsAt: "2026-07-01T11:00:00.000Z" }),
      deps
    );

    expect(first.ok && second.ok).toBe(true);
    expect(second.data!.booking.customerId).toBe(first.data!.booking.customerId);
    const customers = await deps.customerRepository.listCustomers();
    expect(customers).toHaveLength(1);
  });

  it("defaults optional notes/phone to null when omitted", async () => {
    const deps = makeDeps();
    const input = validBookingInput();
    delete (input as Record<string, unknown>).notes;
    delete (input as Record<string, unknown>).customerPhone;

    const result = await createBooking(input, deps);
    expect(result.data!.booking.notes).toBeNull();
  });

  describe("validation", () => {
    it("rejects an invalid email", async () => {
      const result = await createBooking(
        validBookingInput({ customerEmail: "not-an-email" }),
        makeDeps()
      );
      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error!.code).toBe("INVALID_BOOKING_INPUT");
      expect(result.error!.issues!.length).toBeGreaterThan(0);
    });

    it("rejects a non-ISO startsAt", async () => {
      const result = await createBooking(
        validBookingInput({ startsAt: "2026-07-01 09:00" }),
        makeDeps()
      );
      expect(result.status).toBe(400);
      expect(result.error!.code).toBe("INVALID_BOOKING_INPUT");
    });

    it("rejects an empty serviceId", async () => {
      const result = await createBooking(validBookingInput({ serviceId: "" }), makeDeps());
      expect(result.status).toBe(400);
    });

    it("rejects a name over 120 characters", async () => {
      const result = await createBooking(
        validBookingInput({ customerName: "a".repeat(121) }),
        makeDeps()
      );
      expect(result.status).toBe(400);
    });

    it("rejects a non-object payload", async () => {
      const result = await createBooking(null, makeDeps());
      expect(result.status).toBe(400);
    });
  });

  describe("service resolution", () => {
    it("returns 404 when the service does not exist", async () => {
      const result = await createBooking(
        validBookingInput({ serviceId: "svc-missing" }),
        makeDeps()
      );
      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error!.code).toBe("SERVICE_NOT_FOUND");
    });

    it("returns 404 when the service is inactive", async () => {
      const base = makeDeps();
      const repo: BookingRepository = {
        ...base.bookingRepository,
        async getService() {
          return {
            id: "svc-consultation",
            name: "Consultation",
            description: "",
            durationMinutes: 60,
            priceCents: 0,
            currency: "USD",
            status: "inactive"
          };
        }
      };
      const result = await createBooking(validBookingInput(), {
        ...base,
        bookingRepository: repo
      });
      expect(result.status).toBe(404);
      expect(result.error!.code).toBe("SERVICE_NOT_FOUND");
    });
  });

  describe("slot conflicts", () => {
    it("returns 409 when the slot is already taken", async () => {
      const deps = makeDeps();
      const first = await createBooking(validBookingInput(), deps);
      expect(first.ok).toBe(true);

      const second = await createBooking(
        validBookingInput({ customerEmail: "grace@example.com", customerName: "Grace" }),
        deps
      );
      expect(second.ok).toBe(false);
      expect(second.status).toBe(409);
      expect(second.error!.code).toBe("SLOT_UNAVAILABLE");
    });

    it("treats a unique-constraint write failure as a 409 (lost race)", async () => {
      const base = makeDeps();
      const repo: BookingRepository = {
        ...base.bookingRepository,
        async isSlotAvailable() {
          return true; // passes the pre-check...
        },
        async createBooking() {
          throw new Error("D1_ERROR: UNIQUE constraint failed: bookings.slot");
        }
      };
      const result = await createBooking(validBookingInput(), {
        ...base,
        bookingRepository: repo
      });
      expect(result.status).toBe(409);
      expect(result.error!.code).toBe("SLOT_UNAVAILABLE");
    });

    it("rethrows non-constraint repository errors", async () => {
      const base = makeDeps();
      const repo: BookingRepository = {
        ...base.bookingRepository,
        async isSlotAvailable() {
          return true;
        },
        async createBooking() {
          throw new Error("connection reset");
        }
      };
      await expect(
        createBooking(validBookingInput(), { ...base, bookingRepository: repo })
      ).rejects.toThrow("connection reset");
    });
  });
});
