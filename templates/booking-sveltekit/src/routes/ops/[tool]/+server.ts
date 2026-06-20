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
import { getCustomer } from "@microservices-sh/customer";
import { listBookings } from "@microservices-sh/booking";
import { createOpsHandler } from "@microservices-sh/research/ops-http";
import { createOpsTokenVerifier } from "@microservices-sh/research/ops-token";
import { createOpsRegistry, toBookingRecord, toCustomerRecord } from "@microservices-sh/research/ops-registry";

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const secret = platform?.env?.OPS_VERIFY_SECRET;
  if (!secret) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "OPS_NOT_CONFIGURED", message: "OPS_VERIFY_SECRET is not set." } }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }

  const verifier = createOpsTokenVerifier({ secret, now: () => Date.now() });
  const registry = createOpsRegistry({
    "ops.customer.read": async (args) => {
      const id = String(args.id ?? "");
      if (!id) return [];
      const r = await getCustomer({ id }, { customerRepository: locals.customerRepository });
      return r.ok && r.data ? [toCustomerRecord(r.data.customer, Date.now())] : [];
    },
    "ops.booking.read": async () => {
      const r = await listBookings({ bookingRepository: locals.bookingRepository });
      return r.ok && r.data ? r.data.bookings.map((b) => toBookingRecord(b, Date.now())) : [];
    }
  });

  return createOpsHandler({ registry, verifier })(request);
};
