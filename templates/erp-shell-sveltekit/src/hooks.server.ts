import type { Handle, HandleServerError } from "@sveltejs/kit";
import { resolveStores } from "$lib/server/stores";
import { getCurrentUser } from "$lib/server/session";
import { createKvRateLimitStore } from "@microservices-sh/gateway/adapters/kv-rate-limit";
import { createMemoryRateLimitStore } from "@microservices-sh/gateway/adapters/memory-rate-limit";
import { createStripePaymentGateway } from "@microservices-sh/payment/adapters/stripe-gateway";
import { createMemoryPaymentGateway } from "@microservices-sh/payment/adapters/memory-gateway";
import { reportRuntimeError } from "$lib/server/observability";

// Memory rate limiter for local dev / when no KV binding exists. Per-isolate and
// non-durable — KV (RATE_LIMIT_KV) is used in production for shared, durable limits.
const memoryRateLimitStore = createMemoryRateLimitStore();
// Memory payment gateway for local dev; Stripe when STRIPE_SECRET_KEY is set.
const memoryPaymentGateway = createMemoryPaymentGateway();

// Wire module stores + the session user onto locals for every request. Stores are
// D1/R2-backed in production and memory-backed locally. Route adapters consume
// only the module port interfaces and the resolved user — never adapters directly.
export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  const db = env?.DB;
  const bucket = env?.MEDIA_BUCKET;
  const stores = resolveStores(db, bucket);

  event.locals.rbacStore = stores.rbacStore;
  event.locals.tableGateway = stores.tableGateway;
  event.locals.auditStore = stores.auditStore;
  event.locals.signingKeyStore = stores.signingKeyStore;
  event.locals.customerRepository = stores.customerRepository;
  event.locals.ticketStore = stores.ticketStore;
  event.locals.invoiceStore = stores.invoiceStore;
  event.locals.numberAllocator = stores.numberAllocator;
  event.locals.mediaStore = stores.mediaStore;
  event.locals.objectStorage = stores.objectStorage;
  event.locals.notificationStore = stores.notificationStore;
  event.locals.jobStore = stores.jobStore;
  event.locals.accountStore = stores.accountStore;
  event.locals.loginCodeStore = stores.loginCodeStore;
  event.locals.sessionStore = stores.sessionStore;
  event.locals.rateLimitStore = env?.RATE_LIMIT_KV
    ? createKvRateLimitStore(env.RATE_LIMIT_KV)
    : memoryRateLimitStore;
  event.locals.paymentRepository = stores.paymentRepository;
  event.locals.paymentGateway = env?.STRIPE_SECRET_KEY
    ? createStripePaymentGateway(env.STRIPE_SECRET_KEY)
    : memoryPaymentGateway;
  event.locals.user = await getCurrentUser(event.cookies, {
    accountStore: stores.accountStore,
    sessionStore: stores.sessionStore
  });

  return resolve(event);
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
  reportRuntimeError(error, event, { status, message });
  return { message };
};
