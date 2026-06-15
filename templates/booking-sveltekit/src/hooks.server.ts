import type { Handle } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { createD1BookingRepository } from "@microservices-sh/booking/adapters/d1";
import { createMemoryBookingRepository } from "@microservices-sh/booking/adapters/memory";
import { createD1CustomerRepository } from "@microservices-sh/customer/adapters/d1";
import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";
import { verifyToken } from "@microservices-sh/auth";
import { createD1SigningKeyStore } from "@microservices-sh/auth/adapters/d1";
import { createMemorySigningKeyStore } from "@microservices-sh/auth/adapters/memory";
import { createD1ApiKeyStore } from "@microservices-sh/gateway/adapters/d1";
import { createMemoryApiKeyStore } from "@microservices-sh/gateway/adapters/memory";
import { createKvRateLimitStore } from "@microservices-sh/gateway/adapters/kv-rate-limit";
import { createMemoryRateLimitStore } from "@microservices-sh/gateway/adapters/memory-rate-limit";
import { createLocalTokenMinter } from "@microservices-sh/gateway/adapters/token-minter";

// Memory fallbacks for local dev without D1/KV. Singletons so state persists
// across requests in a dev session.
const memoryBookingRepository = createMemoryBookingRepository();
const memoryCustomerRepository = createMemoryCustomerRepository();
const memorySigningKeyStore = createMemorySigningKeyStore();
const memoryApiKeyStore = createMemoryApiKeyStore();
const memoryRateLimitStore = createMemoryRateLimitStore();

// API paths reachable without a token: the public booking flow, token exchange,
// JWKS, and the one-time bootstrap (which self-disables once a signing key exists).
const PUBLIC_API = new Set([
  "/api/availability",
  "/api/bookings",
  "/api/gateway/tokens",
  "/api/auth/jwks",
  "/api/auth/bootstrap",
  // Scheduled endpoints — self-gated by CRON_TOKEN, not the gateway token.
  "/api/cron/run",
  "/api/holds/expire",
  // Stripe webhook — self-gated by signature verification, not the gateway token.
  "/api/payments/webhook"
]);

export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  const db = env?.DB;

  event.locals.bookingRepository = db ? createD1BookingRepository(db) : memoryBookingRepository;
  event.locals.customerRepository = db ? createD1CustomerRepository(db) : memoryCustomerRepository;

  const signingKeyStore = db ? createD1SigningKeyStore(db) : memorySigningKeyStore;
  event.locals.signingKeyStore = signingKeyStore;
  event.locals.apiKeyStore = db ? createD1ApiKeyStore(db) : memoryApiKeyStore;
  event.locals.rateLimitStore = env?.RATE_LIMIT_KV ? createKvRateLimitStore(env.RATE_LIMIT_KV) : memoryRateLimitStore;
  event.locals.tokenMinter = createLocalTokenMinter({ signingKeyStore });
  event.locals.claims = null;

  const path = event.url.pathname;

  // Front door: machine-facing /api/* routes require a gateway-issued token,
  // except the public exchange/JWKS/bootstrap. SSR pages keep the session user.
  if (path.startsWith("/api/") && !PUBLIC_API.has(path)) {
    const authz = event.request.headers.get("authorization") ?? "";
    const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
    const verified = await verifyToken(token, { signingKeyStore });
    if (!verified.ok) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    event.locals.claims = verified.data.claims;
    event.locals.user = {
      id: verified.data.claims.sub,
      email: "",
      isAdmin: verified.data.claims.scopes.includes("gateway.admin")
    };
  } else if (dev) {
    // Local dev ONLY: inject an admin session so the SSR admin UI is usable
    // without a login flow. Guarded by `dev` so it can never run in production.
    event.locals.user = {
      id: "local-admin",
      email: "admin@example.com",
      isAdmin: true
    };
  } else {
    // Production SSR pages have no authenticated user until a real admin session
    // is established. Routes under /admin enforce this and fail closed (see
    // src/routes/admin/+layout.server.ts). Wire a prod admin session here (e.g.
    // a cookie minted from a gateway.admin-scoped token) to light up /admin.
    event.locals.user = null;
  }

  return resolve(event);
};
