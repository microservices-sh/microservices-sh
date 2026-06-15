/* ─────────────────────────────────────────────────────────────────────────
   Worked example: use the booking module end to end.

   This is the reference an AI agent (or a developer) should read to learn how to
   call the booking use cases — what to import, how to wire dependencies, the
   shape of inputs, and how to handle the { ok, data } | { ok: false, error }
   result. It is framework-neutral (no SvelteKit/Hono) and runs against the
   in-memory adapters, so it works with no database or secrets.

   Run it:  npx tsx examples/use-booking.ts   (from the booking module root)

   In a real app you call the same functions; only dependency wiring differs —
   pass `{ DB }` to createBookingDeps for Cloudflare D1 instead of the in-memory
   fallback. A route adapter parses the request, calls these use cases, and maps
   the neutral result to a framework response (see the booking-sveltekit template:
   templates/booking-sveltekit/src/routes/book/+page.server.ts).
   ───────────────────────────────────────────────────────────────────────── */
import {
  createBooking,
  getAvailability,
  listBookings,
  cancelBooking,
} from "@microservices-sh/booking";
import { createBookingDeps } from "@microservices-sh/booking/deps";

async function main() {
  // 1. Wire dependencies. No env → in-memory adapters (the memory repository
  //    seeds demo services, so there is something to book).
  const deps = createBookingDeps();

  // 2. List the bookable services to pick one.
  const services = await deps.bookingRepository.listServices();
  const service = services[0];
  console.log(`Service: ${service.name} (${service.id}, ${service.durationMinutes} min)`);

  // 3. Query availability for that service on a given date (YYYY-MM-DD).
  //    Results are { ok, status, data } on success or { ok, status, error } on
  //    failure; narrow with `"error" in result` to access the right branch.
  const date = "2026-07-01";
  const availability = await getAvailability({ serviceId: service.id, date }, deps);
  if ("error" in availability) {
    console.error("Availability query failed:", availability.error);
    return;
  }
  const slot = availability.data.slots.find((s) => s.available);
  if (!slot) {
    console.log("No open slots on", date);
    return;
  }
  console.log(`First open slot: ${slot.startsAt}`);

  // 4. Create a booking. createBooking validates input, upserts the customer
  //    (via the customer repository in deps), checks the slot, and emits a
  //    booking.confirmed domain event. The result is a discriminated union.
  const result = await createBooking(
    {
      serviceId: service.id,
      startsAt: slot.startsAt,
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+1 555 0100",
      notes: "First visit",
    },
    deps,
  );

  if ("error" in result) {
    // Errors are structured: { code, message, issues? } with an HTTP-ish status.
    console.error(`Booking failed (${result.status}):`, result.error);
    return;
  }
  const { booking } = result.data;
  console.log(`Booked ${booking.id} for ${booking.customerName} at ${booking.startsAt}`);

  // 5. Read back the bookings, then cancel the one we made.
  const all = await listBookings(deps);
  console.log(`Total bookings: ${all.data.bookings.length}`);

  const cancelled = await cancelBooking({ id: booking.id }, deps);
  if ("error" in cancelled) console.error(`Cancel failed (${cancelled.status}):`, cancelled.error);
  else console.log(`Cancelled ${booking.id}`);
}

main().catch((error) => {
  console.error(error);
});
