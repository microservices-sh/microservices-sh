import { beforeEach, describe, expect, it } from "vitest";
import { cancelBooking } from "../../src/use-cases/cancel-booking";
import { bookingInput, tryMakeD1, type D1Harness } from "./d1-harness";

const harness = await tryMakeD1();

// Requires Node started with --experimental-sqlite (set via NODE_OPTIONS in the
// test script). Skips cleanly elsewhere instead of failing the whole suite.
describe.skipIf(!harness)("D1BookingRepository (real SQL via node:sqlite)", () => {
  let h: D1Harness;

  beforeEach(async () => {
    h = (await tryMakeD1())!;
  });

  it("lists only active services", async () => {
    const services = await h.repo.listServices();
    expect(services.map((s) => s.id)).toEqual(["svc-consultation"]);
  });

  it("creates and reads back a booking via the customer/service joins", async () => {
    const created = await h.repo.createBooking(bookingInput());
    const fetched = await h.repo.getBooking(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.serviceName).toBe("Consultation");
    expect(fetched!.customerName).toBe("Ada Lovelace");
    expect(fetched!.customerEmail).toBe("ada@example.com");
    expect(fetched!.status).toBe("confirmed");
  });

  describe("isSlotAvailable overlap SQL (starts_at < ? AND ends_at > ?)", () => {
    beforeEach(async () => {
      await h.repo.createBooking(bookingInput()); // 09:00–10:00 confirmed
    });

    it("reports an exact overlap as unavailable", async () => {
      const free = await h.repo.isSlotAvailable({
        serviceId: "svc-consultation",
        startsAt: "2026-07-01T09:00:00.000Z",
        endsAt: "2026-07-01T10:00:00.000Z"
      });
      expect(free).toBe(false);
    });

    it("reports a partial overlap as unavailable", async () => {
      const free = await h.repo.isSlotAvailable({
        serviceId: "svc-consultation",
        startsAt: "2026-07-01T09:30:00.000Z",
        endsAt: "2026-07-01T10:30:00.000Z"
      });
      expect(free).toBe(false);
    });

    it("treats an adjacent slot (touching boundary) as available", async () => {
      const free = await h.repo.isSlotAvailable({
        serviceId: "svc-consultation",
        startsAt: "2026-07-01T10:00:00.000Z",
        endsAt: "2026-07-01T11:00:00.000Z"
      });
      expect(free).toBe(true);
    });
  });

  it("enforces the confirmed-slot unique index on double booking", async () => {
    await h.repo.createBooking(bookingInput());
    await expect(h.repo.createBooking(bookingInput())).rejects.toThrow(/unique|constraint/i);
  });

  it("cancelBooking flips status and frees the slot for rebooking", async () => {
    const created = await h.repo.createBooking(bookingInput());

    const cancelled = await h.repo.cancelBooking(created.id);
    expect(cancelled!.status).toBe("cancelled");

    // Partial unique index ignores cancelled rows → same slot rebooks cleanly.
    const free = await h.repo.isSlotAvailable({
      serviceId: "svc-consultation",
      startsAt: "2026-07-01T09:00:00.000Z",
      endsAt: "2026-07-01T10:00:00.000Z"
    });
    expect(free).toBe(true);
    await expect(h.repo.createBooking(bookingInput())).resolves.toBeTruthy();
  });

  it("cancelBooking returns null for an unknown id", async () => {
    expect(await h.repo.cancelBooking("bk_missing")).toBeNull();
  });

  it("writeEvent (via cancelBooking use case) lands rows in domain + audit tables", async () => {
    const created = await h.repo.createBooking(bookingInput());
    await cancelBooking(
      { id: created.id, reason: "customer request" },
      { bookingRepository: h.repo, actor: { id: "act_admin" } }
    );

    const domain = h.raw
      .prepare("SELECT event_name FROM domain_events WHERE entity_id = ?")
      .all(created.id);
    const audit = h.raw
      .prepare("SELECT actor_id FROM audit_events WHERE entity_id = ?")
      .all(created.id);
    expect(domain.map((r: any) => r.event_name)).toContain("booking.cancelled");
    expect(audit[0]?.actor_id).toBe("act_admin");
  });

  it("lists bookings newest-first", async () => {
    await h.repo.createBooking(bookingInput({ startsAt: "2026-07-01T09:00:00.000Z", endsAt: "2026-07-01T10:00:00.000Z" }));
    await h.repo.createBooking(bookingInput({ startsAt: "2026-07-01T13:00:00.000Z", endsAt: "2026-07-01T14:00:00.000Z" }));
    const all = await h.repo.listBookings();
    expect(all.map((b) => b.startsAt)).toEqual([
      "2026-07-01T13:00:00.000Z",
      "2026-07-01T09:00:00.000Z"
    ]);
  });
});
