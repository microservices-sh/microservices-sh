export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists }) {
  assertFileIncludesAll(
    "docs/api-boundary.md",
    ["Use Case Shape", "Route Adapter Shape"],
    "API boundary docs define route adapter and use case shapes."
  );
  assertFileIncludesAll(
    "src/routes/api/bookings/+server.ts",
    ["@microservices-sh/booking", "createBooking", "customerRepository", "toSvelteKitResponse"],
    "Booking API route stays a thin adapter over createBooking and injected repositories."
  );
  assertFileIncludesAll(
    "src/routes/admin/customers/+page.server.ts",
    ["@microservices-sh/customer", "listCustomers", "customerRepository"],
    "Customer admin route uses @microservices-sh/customer."
  );
  assertFileIncludes(
    "migrations/0003_booking_slot_constraints.sql",
    "idx_bookings_confirmed_slot",
    "Template keeps the confirmed booking slot constraint migration."
  );
  assertFileIncludesAll(
    "scripts/smoke-http.mjs",
    ["api:/api/bookings:duplicate-slot", "SLOT_UNAVAILABLE"],
    "HTTP smoke script verifies duplicate booking slot rejection."
  );
  assertFileIncludesAll(
    "scripts/smoke-http.mjs",
    ["api:/api/login:request", "api:/api/login:wrong-code-401", "api:/api/login:verify-session-cookie"],
    "HTTP smoke script exercises the passwordless login flow (request, wrong-code 401, verify + session cookie)."
  );
  assertFileIncludesAll(
    "src/routes/api/login/+server.ts",
    ["@microservices-sh/identity", "requestLoginCode", "verifyLoginCode", "serializeSessionCookie"],
    "Login route adapts @microservices-sh/identity (request/verify + session cookie)."
  );
  assert(
    !exists("src/lib/server/modules/booking/index.ts"),
    "Template does not own booking internals.",
    "policy:no-local-booking-module"
  );
}
