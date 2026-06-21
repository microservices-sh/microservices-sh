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
  assertFileIncludesAll(
    "package.json",
    ["@microservices-sh/membership-credits"],
    "Booking template depends on the membership-credits module for customer credit operations."
  );
  assertFileIncludesAll(
    "src/hooks.server.ts",
    ["createD1MembershipCreditsStore", "createMembershipCreditsMemoryStore", "event.locals.membershipCreditsStore"],
    "Booking template injects the membership-credits store through SvelteKit locals."
  );
  assertFileIncludesAll(
    "src/lib/server/membership-credits.ts",
    ["createMembershipCreditsService", "getCompanySettings", "MEMBERSHIP_CREDITS_TENANT_ID"],
    "Membership credits service setup is centralized and derives currency from booking settings."
  );
  assertFileIncludesAll(
    "src/routes/admin/customers/[id]/+page.server.ts",
    [
      "@microservices-sh/membership-credits",
      "membershipCreditsService",
      "getCustomerMembershipSnapshot",
      "grantCustomerCredit",
      "debitCustomerCredit",
      "assignMembership",
      "changeMembershipTier",
      "cancelMembership"
    ],
    "Customer detail route stays a thin adapter over the membership-credits service."
  );
  assertFileIncludesAll(
    "src/routes/admin/membership-credits/+page.server.ts",
    [
      "@microservices-sh/membership-credits",
      "listMembershipTiers",
      "getCustomerMembershipSnapshot",
      "createMembershipTier",
      "expireMemberships"
    ],
    "Membership credits admin route uses module service APIs for tiers, snapshots, and expiry."
  );
  assertFileIncludesAll(
    "src/routes/+layout.svelte",
    ["/admin/membership-credits", "Credits"],
    "Primary admin navigation exposes the membership credits surface."
  );
  assertFileIncludesAll(
    "microservices.config.json",
    ["membershipCredits", "defaultCurrency", "/admin/membership-credits"],
    "Template config declares the membership credits surface and defaults."
  );
  assertFileIncludesAll(
    "migrations/0012_membership_credits.sql",
    ["membership_credit_tiers", "customer_credit_balances", "credit_transactions", "idx_credit_transactions_reference"],
    "Booking template includes the membership-credits persistence tables."
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
  assertFileIncludesAll(
    "scripts/generate-mcp.mjs",
    ["loadConnections", "connections: loadConnections", "generateToolManifest(m)", "templateId"],
    "Booking MCP generator reads authoritative module rpc contracts and normalizes the template id."
  );
  assertFileIncludesAll(
    "src/lib/server/mcp-wiring.ts",
    [
      "customer_getCustomer",
      "customer_listCustomers",
      "customer_upsertCustomer",
      "booking_listBookings",
      "booking_getBooking",
      "booking_getAvailability"
    ],
    "Booking MCP wiring binds governed customer and booking domain tools."
  );
  assert(
    !exists("src/lib/server/modules/booking/index.ts"),
    "Template does not own booking internals.",
    "policy:no-local-booking-module"
  );
}
