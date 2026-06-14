import type { Handle } from "@sveltejs/kit";
import { createD1CustomerRepository } from "@microservices-sh/customer/adapters/d1";
import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";
import { createD1InvoiceStore, createD1NumberAllocator } from "@microservices-sh/invoice";
import { createMemoryInvoiceStore, createMemoryNumberAllocator } from "@microservices-sh/invoice";
import { createD1MediaStore } from "@microservices-sh/file-media/adapters/d1";
import { createMemoryMediaStore } from "@microservices-sh/file-media/adapters/memory";
import { createR2ObjectStorage } from "@microservices-sh/file-media/adapters/r2";
import { createMemoryObjectStorage } from "@microservices-sh/file-media";
import { createD1AuditEventStore } from "@microservices-sh/audit-log/adapters/d1";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import { createD1SigningKeyStore } from "@microservices-sh/auth/adapters/d1";
import { createMemorySigningKeyStore } from "@microservices-sh/auth/adapters/memory";
import { seedDemoData } from "$lib/server/demo";

// Memory fallbacks for local dev without D1/R2. Singletons so seeded demo state
// persists across requests in a dev session.
const memoryCustomerRepository = createMemoryCustomerRepository();
const memoryInvoiceStore = createMemoryInvoiceStore();
const memoryNumberAllocator = createMemoryNumberAllocator();
const memoryMediaStore = createMemoryMediaStore();
const memoryObjectStorage = createMemoryObjectStorage();
const memoryAuditStore = createMemoryAuditEventStore();
const memorySigningKeyStore = createMemorySigningKeyStore();

const DEFAULT_TENANT_ID = "demo-tenant";
// Email of the demo customer whose portal a "customer" session views locally.
const DEMO_CUSTOMER_EMAIL = "owner@acme.example";

export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  const db = env?.DB;
  const bucket = env?.MEDIA_BUCKET;
  const tenantId = env?.MICROSERVICES_TENANT_ID ?? DEFAULT_TENANT_ID;

  event.locals.tenantId = tenantId;
  event.locals.customerRepository = db ? createD1CustomerRepository(db) : memoryCustomerRepository;
  event.locals.invoiceStore = db ? createD1InvoiceStore(db) : memoryInvoiceStore;
  event.locals.numberAllocator = db ? createD1NumberAllocator(db) : memoryNumberAllocator;
  event.locals.mediaStore = db ? createD1MediaStore(db) : memoryMediaStore;
  event.locals.objectStorage = bucket ? createR2ObjectStorage(bucket) : memoryObjectStorage;
  event.locals.auditStore = db ? createD1AuditEventStore(db) : memoryAuditStore;
  event.locals.signingKeyStore = db ? createD1SigningKeyStore(db) : memorySigningKeyStore;
  event.locals.claims = null;

  // Local demo: seed the in-memory stores so the portal renders real,
  // module-produced data without D1/R2. No-op when bindings are present.
  if (!db) {
    await seedDemoData({
      tenantId,
      customerRepository: memoryCustomerRepository,
      invoiceStore: memoryInvoiceStore,
      numberAllocator: memoryNumberAllocator,
      mediaStore: memoryMediaStore,
      objectStorage: memoryObjectStorage,
      auditStore: memoryAuditStore
    });
  }

  // Demo session resolution. Staff side is reachable with ?role=staff (and is
  // remembered via a cookie) so both portal and admin can be exercised locally.
  // Replace this block with real auth-module session verification before beta.
  const roleParam = event.url.searchParams.get("role");
  if (roleParam === "staff" || roleParam === "customer") {
    event.cookies.set("portal_role", roleParam, { path: "/", httpOnly: true, sameSite: "lax" });
  }
  const role = (event.cookies.get("portal_role") as "staff" | "customer" | undefined) ?? "customer";

  if (role === "staff") {
    event.locals.user = { id: "staff-1", email: "staff@example.com", role: "staff", customerId: null };
  } else {
    const customer = await event.locals.customerRepository.findCustomerByEmail(DEMO_CUSTOMER_EMAIL);
    event.locals.user = {
      id: customer?.id ?? "customer-1",
      email: customer?.email ?? DEMO_CUSTOMER_EMAIL,
      role: "customer",
      customerId: customer?.id ?? null
    };
  }

  return resolve(event);
};
