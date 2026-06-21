import type { Handle, HandleServerError } from "@sveltejs/kit";
import { resolveStores } from "$lib/server/stores";
import { getCurrentUser } from "$lib/server/session";
import { createKvRateLimitStore } from "@microservices-sh/gateway/adapters/kv-rate-limit";
import { createMemoryRateLimitStore } from "@microservices-sh/gateway/adapters/memory-rate-limit";
import { createMemoryInvoicePaymentLinkProvider } from "@microservices-sh/invoice/adapters/memory-payment-link";
import { createStripeInvoicePaymentLinkProvider } from "@microservices-sh/invoice/adapters/stripe-payment-link";
import { createStripePaymentGateway } from "@microservices-sh/payment/adapters/stripe-gateway";
import { createMemoryPaymentGateway } from "@microservices-sh/payment/adapters/memory-gateway";
import { createCfQueueProducer } from "@microservices-sh/jobs-workflows";
import { getEmailDeps } from "$lib/server/email-deps";
import { reportRuntimeError, logRequest, generateRequestId } from "$lib/server/observability";
import { readCompanyOrgId } from "$lib/server/org-context";

// Memory rate limiter for local dev / when no KV binding exists. Per-isolate and
// non-durable — KV (RATE_LIMIT_KV) is used in production for shared, durable limits.
const memoryRateLimitStore = createMemoryRateLimitStore();
// Memory payment gateway for local dev; Stripe when STRIPE_SECRET_KEY is set.
const memoryPaymentGateway = createMemoryPaymentGateway();
const memoryInvoicePaymentLinkProvider = createMemoryInvoicePaymentLinkProvider();

// Wire module stores + the session user onto locals for every request. Stores are
// D1/R2-backed in production and memory-backed locally. Route adapters consume
// only the module port interfaces and the resolved user — never adapters directly.
export const handle: Handle = async ({ event, resolve }) => {
  // Per-request observability: stamp a request id up front and start the clock.
  // Stored on locals so handleError can correlate a runtime error with the
  // request log line even when resolve throws.
  const requestId = generateRequestId();
  event.locals.requestId = requestId;
  const startedAt = Date.now();

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
  event.locals.recurringInvoiceStore = stores.recurringInvoiceStore;
  event.locals.numberAllocator = stores.numberAllocator;
  event.locals.invoicePaymentLinkProvider = env?.STRIPE_SECRET_KEY
    ? createStripeInvoicePaymentLinkProvider(env.STRIPE_SECRET_KEY)
    : memoryInvoicePaymentLinkProvider;
  const emailDeps = getEmailDeps(db, env);
  event.locals.emailProvider = emailDeps.provider;
  event.locals.emailRepository = emailDeps.emailRepository;
  event.locals.emailFrom = emailDeps.from;
  event.locals.mediaStore = stores.mediaStore;
  event.locals.objectStorage = stores.objectStorage;
  event.locals.notificationStore = stores.notificationStore;
  event.locals.jobStore = stores.jobStore;
  event.locals.jobRunStore = stores.jobRunStore;
  event.locals.scheduleStore = stores.scheduleStore;
  event.locals.jobQueue = env?.JOB_QUEUE ? createCfQueueProducer(env.JOB_QUEUE) : undefined;
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
  event.locals.productCatalogStore = stores.productCatalogStore;
  event.locals.inventoryStore = stores.inventoryStore;
  event.locals.salesOrderStore = stores.salesOrderStore;
  event.locals.shipmentStore = stores.shipmentStore;
  event.locals.commerceSyncService = stores.commerceSyncService;
  event.locals.user = await getCurrentUser(event.cookies, {
    accountStore: stores.accountStore,
    sessionStore: stores.sessionStore
  });

  // Resolve the request, then emit one structured request log line. Wrapping is
  // additive: store-wiring and the user resolution above are untouched, and we
  // log on both success and failure paths (without swallowing the error).
  let response: Response | undefined;
  try {
    response = await resolve(event);
    return response;
  } finally {
    // Tenant = the remembered company org (cookie); actor = the session user.
    // Read after resolve so a route that just set the cookie is reflected.
    const tenantId = readCompanyOrgId(event.cookies);
    event.locals.tenantId = tenantId;
    logRequest(
      {
        requestId,
        method: event.request.method,
        path: event.url.pathname,
        status: response?.status ?? 500,
        durationMs: Date.now() - startedAt,
        tenantId,
        actorId: event.locals.user?.id ?? null
      },
      event.platform
    );
  }
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
  // Enrich with the request-scoped context the handle hook stamped onto locals
  // (requestId/tenantId) plus the resolved actor, when available.
  reportRuntimeError(error, event, {
    status,
    message,
    requestId: event.locals.requestId ?? null,
    tenantId: event.locals.tenantId ?? null,
    actorId: event.locals.user?.id ?? null
  });
  return { message };
};
