export default function check({ assertFileIncludes, assertFileExcludes }) {
  assertFileIncludes(
    "migrations/0001_booking.sql",
    "idx_bookings_confirmed_slot",
    "Booking module migration keeps the confirmed booking slot constraint."
  );
  assertFileIncludes(
    "src/adapters/d1-booking-repository.ts",
    "lt(bookings.startsAt, input.endsAt)",
    "D1 booking adapter uses interval overlap checks for availability."
  );
  assertFileIncludes(
    "src/adapters/d1-booking-repository.ts",
    "gt(bookings.endsAt, input.startsAt)",
    "D1 booking adapter uses interval overlap checks for availability."
  );
  assertFileIncludes(
    "src/adapters/memory-booking-repository.ts",
    "bookingOverlaps",
    "Memory booking adapter uses interval overlap checks for availability."
  );
  assertFileExcludes(
    "src/index.ts",
    "listCustomers",
    "Booking module delegates customer list behavior to @microservices-sh/customer."
  );
  assertFileExcludes(
    "src/index.ts",
    "getCustomer",
    "Booking module delegates customer read behavior to @microservices-sh/customer."
  );
}
