import type { Handle } from "@sveltejs/kit";
import { resolveStores, memoryStores } from "$lib/server/stores";
import { readSession } from "$lib/server/session";
import { seedDemoData } from "$lib/server/demo";

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
  event.locals.user = readSession(event.cookies);

  // Local demo: seed the in-memory stores so customers/invoices/files render
  // real, module-produced data without D1/R2. No-op when DB is present.
  if (!db) {
    await seedDemoData({
      tenantId: "demo-company",
      customerRepository: memoryStores.customerRepository,
      invoiceStore: memoryStores.invoiceStore,
      numberAllocator: memoryStores.numberAllocator,
      mediaStore: memoryStores.mediaStore,
      objectStorage: memoryStores.objectStorage,
      auditStore: memoryStores.auditStore
    });
  }

  return resolve(event);
};
