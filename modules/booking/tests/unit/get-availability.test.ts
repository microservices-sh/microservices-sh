import { describe, expect, it } from "vitest";
import { createBooking } from "../../src/use-cases/create-booking";
import { getAvailability } from "../../src/use-cases/get-availability";
import { makeDeps, validBookingInput } from "./helpers";

describe("getAvailability", () => {
  it("returns slots for a valid query and echoes the query", async () => {
    const deps = makeDeps();
    const result = await getAvailability(
      { serviceId: "svc-consultation", date: "2026-07-01" },
      deps
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data!.serviceId).toBe("svc-consultation");
    expect(result.data!.date).toBe("2026-07-01");
    expect(result.data!.slots).toHaveLength(8);
    expect(result.data!.slots.every((slot) => slot.available)).toBe(true);
  });

  it("marks an overlapping slot unavailable once booked", async () => {
    const deps = makeDeps();
    await createBooking(
      validBookingInput({ startsAt: "2026-07-01T09:00:00.000Z" }),
      deps
    );

    const result = await getAvailability(
      { serviceId: "svc-consultation", date: "2026-07-01" },
      deps
    );

    const nineAm = result.data!.slots.find(
      (slot) => slot.startsAt === "2026-07-01T09:00:00.000Z"
    );
    const tenAm = result.data!.slots.find(
      (slot) => slot.startsAt === "2026-07-01T10:00:00.000Z"
    );
    expect(nineAm!.available).toBe(false);
    expect(tenAm!.available).toBe(true);
  });

  it("rejects a malformed date", async () => {
    const result = await getAvailability(
      { serviceId: "svc-consultation", date: "07/01/2026" },
      makeDeps()
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error!.code).toBe("INVALID_AVAILABILITY_QUERY");
  });

  it("rejects a missing serviceId", async () => {
    const result = await getAvailability({ date: "2026-07-01" }, makeDeps());
    expect(result.status).toBe(400);
  });
});
