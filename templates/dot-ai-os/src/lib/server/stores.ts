import { createD1RbacStore } from "@microservices-sh/org-team-rbac/adapters/d1";
import { createMemoryRbacStore } from "@microservices-sh/org-team-rbac/adapters/memory";
import { createD1TableGateway } from "@microservices-sh/admin-shell/adapters/d1";
import { createMemoryTableGateway } from "@microservices-sh/admin-shell/adapters/memory";
import { createD1AuditEventStore } from "@microservices-sh/audit-log/adapters/d1";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import { createD1SigningKeyStore } from "@microservices-sh/auth/adapters/d1";
import { createMemorySigningKeyStore } from "@microservices-sh/auth/adapters/memory";
import { createD1CustomerRepository } from "@microservices-sh/customer/adapters/d1";
import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";
import { createD1TicketStore } from "@microservices-sh/support-ticket/adapters/d1";
import { createMemoryTicketStore } from "@microservices-sh/support-ticket/adapters/memory";
import { createD1KnowledgeStore } from "@microservices-sh/knowledge-base-rag/adapters/d1";
import { createMemoryKnowledgeStore } from "@microservices-sh/knowledge-base-rag/adapters/memory";
import { createD1InvoiceStore, createD1NumberAllocator } from "@microservices-sh/invoice";
import { createMemoryInvoiceStore, createMemoryNumberAllocator } from "@microservices-sh/invoice";
import { createD1MediaStore } from "@microservices-sh/file-media/adapters/d1";
import { createMemoryMediaStore, createMemoryObjectStorage } from "@microservices-sh/file-media";
import { createR2ObjectStorage } from "@microservices-sh/file-media/adapters/r2";
import { createD1NotificationStore } from "@microservices-sh/notifications-inapp/adapters/d1";
import { createMemoryNotificationStore } from "@microservices-sh/notifications-inapp/adapters/memory";
import { createD1JobStore } from "@microservices-sh/jobs-workflows/adapters/d1";
import { createMemoryJobStore } from "@microservices-sh/jobs-workflows/adapters/memory";
import { createD1OperatorWorkStore } from "@microservices-sh/operator-work/adapters/d1";
import { createMemoryOperatorWorkStore } from "@microservices-sh/operator-work/adapters/memory";
import {
  createD1AccountStore,
  createD1LoginCodeStore,
  createD1SessionStore,
  createMemoryAccountStore,
  createMemoryLoginCodeStore,
  createMemorySessionStore,
  type AccountStore,
  type LoginCodeStore,
  type SessionStore
} from "@microservices-sh/identity";

import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import type { TicketStore } from "@microservices-sh/support-ticket/ports";
import type { KnowledgeStore } from "@microservices-sh/knowledge-base-rag/ports";
import type { InvoiceStore, NumberAllocator } from "@microservices-sh/invoice/ports";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import type { NotificationStore } from "@microservices-sh/notifications-inapp/ports";
import type { JobStore } from "@microservices-sh/jobs-workflows/ports";
import type { OperatorWorkStore } from "@microservices-sh/operator-work/ports";

// Memory singletons for local dev without D1/R2. State persists across requests in
// a single dev session so the seeded workspace -> employees -> contacts/work packets/files
// flow stays coherent.
const memoryRbacStore = createMemoryRbacStore();
const memoryTableGateway = createMemoryTableGateway();
const memoryAuditStore = createMemoryAuditEventStore();
const memorySigningKeyStore = createMemorySigningKeyStore();
const memoryCustomerRepository = createMemoryCustomerRepository();
const memoryTicketStore = createMemoryTicketStore();
const memoryKnowledgeStore = createMemoryKnowledgeStore();
const memoryInvoiceStore = createMemoryInvoiceStore();
const memoryNumberAllocator = createMemoryNumberAllocator();
const memoryMediaStore = createMemoryMediaStore();
const memoryObjectStorage = createMemoryObjectStorage();
const memoryNotificationStore = createMemoryNotificationStore();
const memoryJobStore = createMemoryJobStore();
const memoryOperatorWorkStore = createMemoryOperatorWorkStore();
const memoryAccountStore = createMemoryAccountStore();
const memoryLoginCodeStore = createMemoryLoginCodeStore();
const memorySessionStore = createMemorySessionStore();

export interface ServerStores {
  rbacStore: RbacStore;
  tableGateway: TableGateway;
  auditStore: AuditEventStore;
  signingKeyStore: SigningKeyStore;
  customerRepository: CustomerRepository;
  ticketStore: TicketStore;
  knowledgeStore: KnowledgeStore;
  invoiceStore: InvoiceStore;
  numberAllocator: NumberAllocator;
  mediaStore: MediaStore;
  objectStorage: ObjectStorage;
  notificationStore: NotificationStore;
  jobStore: JobStore;
  operatorWorkStore: OperatorWorkStore;
  accountStore: AccountStore;
  loginCodeStore: LoginCodeStore;
  sessionStore: SessionStore;
}

// The platform bindings as declared on App.Platform — referenced via the platform
// type so this file never depends on the bare ambient globals.
type Env = NonNullable<App.Platform["env"]>;
type D1Binding = Env["DB"];
type R2Binding = Env["MEDIA_BUCKET"];

// Resolve the module stores for a request. D1/R2-backed when bindings exist,
// memory-backed otherwise. The route layer only ever sees the port interfaces.
export function resolveStores(db: D1Binding, bucket: R2Binding): ServerStores {
  return {
    rbacStore: db ? createD1RbacStore(db) : memoryRbacStore,
    tableGateway: db ? createD1TableGateway(db) : memoryTableGateway,
    auditStore: db ? createD1AuditEventStore(db) : memoryAuditStore,
    signingKeyStore: db ? createD1SigningKeyStore(db) : memorySigningKeyStore,
    customerRepository: db ? createD1CustomerRepository(db) : memoryCustomerRepository,
    ticketStore: db ? createD1TicketStore(db) : memoryTicketStore,
    knowledgeStore: db ? createD1KnowledgeStore(db) : memoryKnowledgeStore,
    invoiceStore: db ? createD1InvoiceStore(db) : memoryInvoiceStore,
    numberAllocator: db ? createD1NumberAllocator(db) : memoryNumberAllocator,
    mediaStore: db ? createD1MediaStore(db) : memoryMediaStore,
    objectStorage: bucket ? createR2ObjectStorage(bucket) : memoryObjectStorage,
    notificationStore: db ? createD1NotificationStore(db) : memoryNotificationStore,
    jobStore: db ? createD1JobStore(db) : memoryJobStore,
    operatorWorkStore: db ? createD1OperatorWorkStore(db) : memoryOperatorWorkStore,
    accountStore: db ? createD1AccountStore(db) : memoryAccountStore,
    loginCodeStore: db ? createD1LoginCodeStore(db) : memoryLoginCodeStore,
    sessionStore: db ? createD1SessionStore(db) : memorySessionStore
  };
}

// Expose the memory singletons so the dev seeder can drive the same stores the
// request handler reads. No-op when D1/R2 bindings are present.
export const memoryStores = {
  customerRepository: memoryCustomerRepository,
  ticketStore: memoryTicketStore,
  knowledgeStore: memoryKnowledgeStore,
  invoiceStore: memoryInvoiceStore,
  numberAllocator: memoryNumberAllocator,
  mediaStore: memoryMediaStore,
  objectStorage: memoryObjectStorage,
  auditStore: memoryAuditStore,
  operatorWorkStore: memoryOperatorWorkStore
};
