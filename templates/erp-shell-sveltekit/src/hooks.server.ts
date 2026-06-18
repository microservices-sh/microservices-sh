import type { Handle, HandleServerError } from "@sveltejs/kit";
import { resolveStores } from "$lib/server/stores";
import { readSession, getSessionSecret } from "$lib/server/session";
import { reportRuntimeError } from "$lib/server/observability";

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
  event.locals.invoiceStore = stores.invoiceStore;
  event.locals.numberAllocator = stores.numberAllocator;
  event.locals.mediaStore = stores.mediaStore;
  event.locals.objectStorage = stores.objectStorage;
  event.locals.notificationStore = stores.notificationStore;
  event.locals.jobStore = stores.jobStore;
  event.locals.user = await readSession(event.cookies, getSessionSecret(event.platform));

  return resolve(event);
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
  reportRuntimeError(error, event, { status, message });
  return { message };
};
