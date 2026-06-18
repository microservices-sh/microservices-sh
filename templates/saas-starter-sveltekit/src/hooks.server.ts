import type { Handle, HandleServerError } from "@sveltejs/kit";
import { resolveStores } from "$lib/server/stores";
import { getCurrentUser } from "$lib/server/session";
import { createKvRateLimitStore } from "@microservices-sh/gateway/adapters/kv-rate-limit";
import { createMemoryRateLimitStore } from "@microservices-sh/gateway/adapters/memory-rate-limit";
import { reportRuntimeError } from "$lib/server/observability";

const memoryRateLimitStore = createMemoryRateLimitStore();

// Wire module stores + the session user onto locals for every request. Stores are
// D1-backed in production and memory-backed locally. Route adapters consume only
// the module port interfaces and the resolved user — never adapters directly.
export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  const db = env?.DB;
  const stores = await resolveStores(db);

  event.locals.rbacStore = stores.rbacStore;
  event.locals.billingStore = stores.billingStore;
  event.locals.tableGateway = stores.tableGateway;
  event.locals.auditStore = stores.auditStore;
  event.locals.signingKeyStore = stores.signingKeyStore;
  event.locals.accountStore = stores.accountStore;
  event.locals.loginCodeStore = stores.loginCodeStore;
  event.locals.sessionStore = stores.sessionStore;
  event.locals.rateLimitStore = env?.RATE_LIMIT_KV
    ? createKvRateLimitStore(env.RATE_LIMIT_KV)
    : memoryRateLimitStore;
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
