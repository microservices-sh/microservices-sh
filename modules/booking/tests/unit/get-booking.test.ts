import { describe, expect, it } from "vitest";
import { createBooking } from "../../src/use-cases/create-booking";
import { getBooking } from "../../src/use-cases/get-booking";
import { makeDeps, validBookingInput } from "./helpers";

describe("getBooking", () => {
  it("returns a stored booking", async () => {
    const deps = makeDeps();
    const created = await createBooking(validBookingInput(), deps);

    const result = await getBooking({ id: created.data!.booking.id }, deps);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data!.booking.id).toBe(created.data!.booking.id);
  });

  it("returns 404 for an unknown id", async () => {
    const result = await getBooking({ id: "bk_does_not_exist" }, makeDeps());
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error!.code).toBe("BOOKING_NOT_FOUND");
  });
});
