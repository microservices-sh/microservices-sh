import { describe, expect, it } from "vitest";
import { cancelBooking } from "../../src/use-cases/cancel-booking";
import { createBooking } from "../../src/use-cases/create-booking";
import { getAvailability } from "../../src/use-cases/get-availability";
import { makeDeps, validBookingInput } from "./helpers";

describe("cancelBooking", () => {
  it("cancels a confirmed booking", async () => {
    const deps = makeDeps();
    const created = await createBooking(validBookingInput(), deps);
    const id = created.data!.booking.id;

    const result = await cancelBooking({ id }, deps);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data!.booking.status).toBe("cancelled");

    const stored = await deps.bookingRepository.getBooking(id);
    expect(stored!.status).toBe("cancelled");
  });

  it("frees the slot so it can be rebooked", async () => {
    const deps = makeDeps();
    const created = await createBooking(validBookingInput(), deps);

    // Same slot is blocked while confirmed.
    const blocked = await createBooking(
      validBookingInput({ customerEmail: "grace@example.com", customerName: "Grace" }),
      deps
    );
    expect(blocked.status).toBe(409);

    await cancelBooking({ id: created.data!.booking.id }, deps);

    // After cancellation the slot is available again.
    const availability = await getAvailability(
      { serviceId: "svc-consultation", date: "2026-07-01" },
      deps
    );
    const nineAm = availability.data!.slots.find(
      (slot) => slot.startsAt === "2026-07-01T09:00:00.000Z"
    );
    expect(nineAm!.available).toBe(true);

    const rebooked = await createBooking(
      validBookingInput({ customerEmail: "grace@example.com", customerName: "Grace" }),
      deps
    );
    expect(rebooked.ok).toBe(true);
    expect(rebooked.status).toBe(201);
  });

  it("returns 404 for an unknown booking", async () => {
    const result = await cancelBooking({ id: "bk_missing" }, makeDeps());
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error!.code).toBe("BOOKING_NOT_FOUND");
  });

  it("returns 409 when the booking is already cancelled", async () => {
    const deps = makeDeps();
    const created = await createBooking(validBookingInput(), deps);
    const id = created.data!.booking.id;

    await cancelBooking({ id }, deps);
    const second = await cancelBooking({ id, reason: "duplicate" }, deps);

    expect(second.ok).toBe(false);
    expect(second.status).toBe(409);
    expect(second.error!.code).toBe("BOOKING_NOT_CANCELLABLE");
  });

  it("bumps updatedAt on cancellation", async () => {
    const deps = makeDeps();
    const created = await createBooking(validBookingInput(), deps);
    const before = created.data!.booking.updatedAt;

    const result = await cancelBooking({ id: created.data!.booking.id }, deps);
    expect(result.data!.booking.updatedAt >= before).toBe(true);
  });
});
