import type { Handle, HandleServerError } from "@sveltejs/kit";
import { resolveStores } from "$lib/server/stores";
import { readSession, getSessionSecret } from "$lib/server/session";
import { reportRuntimeError } from "$lib/server/observability";

// Wire module stores + the session user onto locals for every request. Stores are
// D1-backed in production and memory-backed locally. Route adapters consume only
// the module port interfaces and the resolved user — never adapters directly.
export const handle: Handle = async ({ event, resolve }) => {
  const db = event.platform?.env?.DB;
  const stores = await resolveStores(db);

  event.locals.rbacStore = stores.rbacStore;
  event.locals.billingStore = stores.billingStore;
  event.locals.tableGateway = stores.tableGateway;
  event.locals.auditStore = stores.auditStore;
  event.locals.signingKeyStore = stores.signingKeyStore;
  event.locals.user = await readSession(event.cookies, getSessionSecret(event.platform));

  return resolve(event);
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
  reportRuntimeError(error, event, { status, message });
  return { message };
};
