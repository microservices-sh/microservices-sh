import { describe, expect, it } from "vitest";
import { createBooking } from "../../src/use-cases/create-booking";
import { listBookings } from "../../src/use-cases/list-bookings";
import { makeDeps, validBookingInput } from "./helpers";

describe("listBookings", () => {
  it("returns an empty list when nothing is booked", async () => {
    const result = await listBookings(makeDeps());
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data!.bookings).toEqual([]);
  });

  it("returns bookings sorted by startsAt ascending", async () => {
    const deps = makeDeps();
    // Insert out of chronological order.
    await createBooking(validBookingInput({ startsAt: "2026-07-01T11:00:00.000Z" }), deps);
    await createBooking(validBookingInput({ startsAt: "2026-07-01T09:00:00.000Z" }), deps);
    await createBooking(validBookingInput({ startsAt: "2026-07-01T13:00:00.000Z" }), deps);

    const result = await listBookings(deps);
    const starts = result.data!.bookings.map((b) => b.startsAt);
    expect(starts).toEqual([
      "2026-07-01T09:00:00.000Z",
      "2026-07-01T11:00:00.000Z",
      "2026-07-01T13:00:00.000Z"
    ]);
  });
});
