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
import { createD1InvoiceStore, createD1NumberAllocator, createD1RecurringInvoiceStore } from "@microservices-sh/invoice";
import { createMemoryInvoiceStore, createMemoryNumberAllocator, createMemoryRecurringInvoiceStore } from "@microservices-sh/invoice";
import { createD1MediaStore } from "@microservices-sh/file-media/adapters/d1";
import { createMemoryMediaStore, createMemoryObjectStorage } from "@microservices-sh/file-media";
import { createR2ObjectStorage } from "@microservices-sh/file-media/adapters/r2";
import { createD1NotificationStore } from "@microservices-sh/notifications-inapp/adapters/d1";
import { createMemoryNotificationStore } from "@microservices-sh/notifications-inapp/adapters/memory";
import {
  createD1JobRunStore,
  createD1JobStore,
  createD1ScheduleStore,
  createMemoryJobRunStore,
  createMemoryJobStore,
  createMemoryScheduleStore
} from "@microservices-sh/jobs-workflows";
import {
  createD1DeliveryLog,
  createD1WebhookEndpointStore,
  createMemoryDeliveryLog,
  createMemoryWebhookEndpointStore
} from "@microservices-sh/webhook-delivery";
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
import { createD1PaymentRepository } from "@microservices-sh/payment/adapters/d1";
import { createMemoryPaymentRepository } from "@microservices-sh/payment/adapters/memory";
import type { PaymentRepository } from "@microservices-sh/payment/ports";
import { createD1BillingStore } from "@microservices-sh/billing-subscriptions/adapters/d1";
import { createMemoryBillingStore } from "@microservices-sh/billing-subscriptions/adapters/memory";
import type { BillingStore } from "@microservices-sh/billing-subscriptions/ports";
import { createD1ImageStore } from "@microservices-sh/image-generation/adapters/d1";
import { createMemoryImageStore } from "@microservices-sh/image-generation/adapters/memory";
import type { ImageStore } from "@microservices-sh/image-generation/ports";
import { createD1AdsStore } from "@microservices-sh/ads-manager/adapters/d1";
import { createMemoryAdsStore } from "@microservices-sh/ads-manager/adapters/memory";
import type { AdsStore } from "@microservices-sh/ads-manager/ports";
import { createD1SmsCampaignsStore } from "@microservices-sh/sms-campaigns/adapters/d1";
import { createSmsCampaignsMemoryStore } from "@microservices-sh/sms-campaigns/adapters/memory";
import type { SmsCampaignsStore } from "@microservices-sh/sms-campaigns/ports";
import { createD1FormStore } from "@microservices-sh/forms-intake/adapters/d1";
import { createMemoryFormStore } from "@microservices-sh/forms-intake/adapters/memory";
import type { FormStore } from "@microservices-sh/forms-intake/ports";
import { createD1BookingRepository } from "@microservices-sh/booking/adapters/d1";
import { createMemoryBookingRepository } from "@microservices-sh/booking/adapters/memory";
import type { BookingRepository } from "@microservices-sh/booking/ports";
import {
  createD1SupportInboxStore,
  createSupportInboxMemoryStore,
  type SupportInboxStore
} from "@microservices-sh/support-inbox";
import {
  createD1ProjectProgressStore,
  createProjectProgressMemoryStore,
  type ProjectProgressStore
} from "@microservices-sh/project-progress";

import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import type { TicketStore } from "@microservices-sh/support-ticket/ports";
import type { InvoiceStore, NumberAllocator, RecurringInvoiceStore } from "@microservices-sh/invoice/ports";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import type { NotificationStore } from "@microservices-sh/notifications-inapp/ports";
import type { JobRunStore, JobStore, ScheduleStore } from "@microservices-sh/jobs-workflows/ports";
import type { DeliveryLogStore, WebhookEndpointStore } from "@microservices-sh/webhook-delivery/ports";

// Memory singletons for local dev without D1/R2. State persists across requests in
// a single dev session so the seeded company → employees → customers/invoices/files
// flow stays coherent.
const memoryRbacStore = createMemoryRbacStore();
const memoryTableGateway = createMemoryTableGateway();
const memoryAuditStore = createMemoryAuditEventStore();
const memorySigningKeyStore = createMemorySigningKeyStore();
const memoryCustomerRepository = createMemoryCustomerRepository();
const memoryTicketStore = createMemoryTicketStore();
const memoryInvoiceStore = createMemoryInvoiceStore();
const memoryRecurringInvoiceStore = createMemoryRecurringInvoiceStore();
const memoryNumberAllocator = createMemoryNumberAllocator();
const memoryMediaStore = createMemoryMediaStore();
const memoryObjectStorage = createMemoryObjectStorage();
const memoryNotificationStore = createMemoryNotificationStore();
const memoryJobStore = createMemoryJobStore();
const memoryJobRunStore = createMemoryJobRunStore();
const memoryScheduleStore = createMemoryScheduleStore();
const memoryWebhookEndpointStore = createMemoryWebhookEndpointStore();
const memoryWebhookDeliveryLog = createMemoryDeliveryLog();
const memoryAccountStore = createMemoryAccountStore();
const memoryLoginCodeStore = createMemoryLoginCodeStore();
const memorySessionStore = createMemorySessionStore();
const memoryPaymentRepository = createMemoryPaymentRepository();
const memoryBillingStore = createMemoryBillingStore();
const memoryImageStore = createMemoryImageStore();
const memoryAdsStore = createMemoryAdsStore();
const memorySmsCampaignsStore = createSmsCampaignsMemoryStore();
const memoryFormStore = createMemoryFormStore();
const memoryBookingRepository = createMemoryBookingRepository();
const memorySupportInboxStore = createSupportInboxMemoryStore();
const memoryProjectProgressStore = createProjectProgressMemoryStore();

export interface ServerStores {
  rbacStore: RbacStore;
  tableGateway: TableGateway;
  auditStore: AuditEventStore;
  signingKeyStore: SigningKeyStore;
  customerRepository: CustomerRepository;
  ticketStore: TicketStore;
  invoiceStore: InvoiceStore;
  recurringInvoiceStore: RecurringInvoiceStore;
  numberAllocator: NumberAllocator;
  mediaStore: MediaStore;
  objectStorage: ObjectStorage;
  notificationStore: NotificationStore;
  jobStore: JobStore;
  jobRunStore: JobRunStore;
  scheduleStore: ScheduleStore;
  webhookEndpointStore: WebhookEndpointStore;
  webhookDeliveryLog: DeliveryLogStore;
  accountStore: AccountStore;
  loginCodeStore: LoginCodeStore;
  sessionStore: SessionStore;
  paymentRepository: PaymentRepository;
  billingStore: BillingStore;
  imageStore: ImageStore;
  adsStore: AdsStore;
  smsCampaignsStore: SmsCampaignsStore;
  formStore: FormStore;
  bookingRepository: BookingRepository;
  supportInboxStore: SupportInboxStore;
  projectProgressStore: ProjectProgressStore;
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
    invoiceStore: db ? createD1InvoiceStore(db) : memoryInvoiceStore,
    recurringInvoiceStore: db ? createD1RecurringInvoiceStore(db) : memoryRecurringInvoiceStore,
    numberAllocator: db ? createD1NumberAllocator(db) : memoryNumberAllocator,
    mediaStore: db ? createD1MediaStore(db) : memoryMediaStore,
    objectStorage: bucket ? createR2ObjectStorage(bucket) : memoryObjectStorage,
    notificationStore: db ? createD1NotificationStore(db) : memoryNotificationStore,
    jobStore: db ? createD1JobStore(db) : memoryJobStore,
    jobRunStore: db ? createD1JobRunStore(db) : memoryJobRunStore,
    scheduleStore: db ? createD1ScheduleStore(db) : memoryScheduleStore,
    webhookEndpointStore: db ? createD1WebhookEndpointStore(db) : memoryWebhookEndpointStore,
    webhookDeliveryLog: db ? createD1DeliveryLog(db) : memoryWebhookDeliveryLog,
    accountStore: db ? createD1AccountStore(db) : memoryAccountStore,
    loginCodeStore: db ? createD1LoginCodeStore(db) : memoryLoginCodeStore,
    sessionStore: db ? createD1SessionStore(db) : memorySessionStore,
    paymentRepository: db ? createD1PaymentRepository(db) : memoryPaymentRepository,
    billingStore: db ? createD1BillingStore(db) : memoryBillingStore,
    imageStore: db ? createD1ImageStore(db) : memoryImageStore,
    adsStore: db ? createD1AdsStore(db) : memoryAdsStore,
    smsCampaignsStore: db ? createD1SmsCampaignsStore(db) : memorySmsCampaignsStore,
    formStore: db ? createD1FormStore(db) : memoryFormStore,
    bookingRepository: db ? createD1BookingRepository(db) : memoryBookingRepository,
    supportInboxStore: db ? createD1SupportInboxStore(db) : memorySupportInboxStore,
    projectProgressStore: db ? createD1ProjectProgressStore(db) : memoryProjectProgressStore
  };
}

// Expose the memory singletons so the dev seeder can drive the same stores the
// request handler reads. No-op when D1/R2 bindings are present.
export const memoryStores = {
  customerRepository: memoryCustomerRepository,
  ticketStore: memoryTicketStore,
  invoiceStore: memoryInvoiceStore,
  recurringInvoiceStore: memoryRecurringInvoiceStore,
  numberAllocator: memoryNumberAllocator,
  supportInboxStore: memorySupportInboxStore,
  projectProgressStore: memoryProjectProgressStore,
  mediaStore: memoryMediaStore,
  objectStorage: memoryObjectStorage,
  auditStore: memoryAuditStore
};
