// Operations read-back endpoint (Plan 32, P1) — the verify side.
//
// The client's Hermes agent (on Fly) calls POST /ops/<tool> with its minted
// OPS_TOKEN to read live operational records (governed, owner-scoped, audited by
// the shared ops layer). This route assembles the reusable, tested pieces from
// @microservices-sh/research: a token verifier (per-tenant OPS_VERIFY_SECRET),
// a registry binding THIS app's module read use-cases to ops tools, and the
// Fetch handler. This template ships customer + booking, so it exposes those two
// tools; an app with more modules registers more.
import type { RequestHandler } from "@sveltejs/kit";
import { getCustomer, listCustomers } from "@microservices-sh/customer";
import { listBookings } from "@microservices-sh/booking";
import { createOpsHandler } from "@microservices-sh/research/ops-http";
import { createOpsTokenVerifier } from "@microservices-sh/research/ops-token";
import { createOpsRegistry, toBookingRecord, toCustomerRecord } from "@microservices-sh/research/ops-registry";

const DEFAULT_OPS_OWNER_ID = "owner";
const MAX_OPS_RECORDS = 20;

function textArg(args: Record<string, unknown>, key: string): string {
  return String(args[key] ?? "").trim();
}

function matchesQuery(query: string, values: Array<string | null | undefined>): boolean {
  const normalized = query.toLowerCase();
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const secret = platform?.env?.OPS_VERIFY_SECRET;
  if (!secret) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "OPS_NOT_CONFIGURED", message: "OPS_VERIFY_SECRET is not set." } }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }

  const ownerId = platform?.env?.OPS_OWNER_ID || DEFAULT_OPS_OWNER_ID;
  const tokenVerifier = createOpsTokenVerifier({ secret, now: () => Date.now() });
  const verifier = {
    async verify(token: string) {
      const result = await tokenVerifier.verify(token);
      if (!result.ok || result.ownerId !== ownerId) return { ok: false as const };
      return result;
    }
  };

  const registry = createOpsRegistry({
    "ops.customer.read": async (args, scope) => {
      if (scope.ownerId !== ownerId) return [];
      const id = textArg(args, "id");
      if (id) {
        const r = await getCustomer({ id }, { customerRepository: locals.customerRepository });
        return r.ok && r.data ? [toCustomerRecord(r.data.customer, Date.now())] : [];
      }

      const query = textArg(args, "query");
      if (!query) return [];
      const r = await listCustomers({ customerRepository: locals.customerRepository });
      if (!r.ok || !r.data) return [];
      return r.data.customers
        .filter((customer) => matchesQuery(query, [customer.id, customer.name, customer.email, customer.phone, customer.notes]))
        .slice(0, MAX_OPS_RECORDS)
        .map((customer) => toCustomerRecord(customer, Date.now()));
    },
    "ops.booking.read": async (args, scope) => {
      if (scope.ownerId !== ownerId) return [];
      const query = textArg(args, "query");
      const result = await listBookings({ bookingRepository: locals.bookingRepository });
      if (!result.ok || !result.data) return [];
      return result.data.bookings
        .filter((booking) =>
          query
            ? matchesQuery(query, [booking.id, booking.customerName, booking.customerEmail, booking.serviceName, booking.status, booking.startsAt])
            : true
        )
        .slice(0, MAX_OPS_RECORDS)
        .map((booking) => toBookingRecord({ ...booking, date: booking.startsAt }, Date.now()));
    }
  });

  return createOpsHandler({ registry, verifier })(request);
};
