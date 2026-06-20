import type { Handle, HandleServerError } from "@sveltejs/kit";
import { resolveStores } from "$lib/server/stores";
import { getCurrentUser } from "$lib/server/session";
import { createKvRateLimitStore } from "@microservices-sh/gateway/adapters/kv-rate-limit";
import { createMemoryRateLimitStore } from "@microservices-sh/gateway/adapters/memory-rate-limit";
import { createStripePaymentGateway } from "@microservices-sh/payment/adapters/stripe-gateway";
import { createMemoryPaymentGateway } from "@microservices-sh/payment/adapters/memory-gateway";
import {
  buildProviders,
  createMemoryImageProvider,
  createMemoryObjectStorage as createMemoryImageStorage,
  createR2ObjectStorage as createR2ImageStorage
} from "@microservices-sh/image-generation";
import { reportRuntimeError } from "$lib/server/observability";

// Memory rate limiter for local dev / when no KV binding exists. Per-isolate and
// non-durable — KV (RATE_LIMIT_KV) is used in production for shared, durable limits.
const memoryRateLimitStore = createMemoryRateLimitStore();
// Memory payment gateway for local dev; Stripe when STRIPE_SECRET_KEY is set.
const memoryPaymentGateway = createMemoryPaymentGateway();
// Memory image-object storage (R2 when IMAGE_BUCKET is bound). Singleton so bytes
// persist across requests in dev.
const memoryImageStorage = createMemoryImageStorage();

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
  event.locals.scheduleStore = stores.scheduleStore;
  event.locals.webhookEndpointStore = stores.webhookEndpointStore;
  event.locals.webhookDeliveryLog = stores.webhookDeliveryLog;
  event.locals.accountStore = stores.accountStore;
  event.locals.loginCodeStore = stores.loginCodeStore;
  event.locals.sessionStore = stores.sessionStore;
  event.locals.rateLimitStore = env?.RATE_LIMIT_KV
    ? createKvRateLimitStore(env.RATE_LIMIT_KV)
    : memoryRateLimitStore;
  event.locals.paymentRepository = stores.paymentRepository;
  event.locals.billingStore = stores.billingStore;
  event.locals.paymentGateway = env?.STRIPE_SECRET_KEY
    ? createStripePaymentGateway(env.STRIPE_SECRET_KEY)
    : memoryPaymentGateway;
  // Image generation: store (D1/memory), object storage (R2/memory), and the
  // provider registry built from env keys — falling back to a memory provider
  // locally so the gallery works without a real image API.
  event.locals.imageStore = stores.imageStore;
  event.locals.imageStorage = env?.IMAGE_BUCKET ? createR2ImageStorage(env.IMAGE_BUCKET) : memoryImageStorage;
  const imageProviders = buildProviders(env ?? {});
  if (Object.keys(imageProviders).length === 0) imageProviders["kie-ai"] = createMemoryImageProvider();
  event.locals.imageProviders = imageProviders;
  event.locals.adsStore = stores.adsStore;
  event.locals.formStore = stores.formStore;
  event.locals.bookingRepository = stores.bookingRepository;
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
