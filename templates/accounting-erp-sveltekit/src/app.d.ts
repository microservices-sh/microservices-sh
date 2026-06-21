import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import type { TicketStore } from "@microservices-sh/support-ticket/ports";
import type { InvoiceStore, NumberAllocator } from "@microservices-sh/invoice/ports";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import type { NotificationStore } from "@microservices-sh/notifications-inapp/ports";
import type { JobStore, QueueProducer, ScheduleStore } from "@microservices-sh/jobs-workflows/ports";
import type { DeliveryLogStore, WebhookEndpointStore } from "@microservices-sh/webhook-delivery/ports";
import type { AccountStore, LoginCodeStore, SessionStore } from "@microservices-sh/identity";
import type { RateLimitStore } from "@microservices-sh/gateway/ports";
import type { PaymentRepository, PaymentGateway } from "@microservices-sh/payment/ports";
import type { BillingStore } from "@microservices-sh/billing-subscriptions/ports";
import type { ImageStore, ObjectStorage as ImageObjectStorage } from "@microservices-sh/image-generation/ports";
import type { ProviderRegistry } from "@microservices-sh/image-generation";
import type { AdsStore } from "@microservices-sh/ads-manager/ports";
import type { FormStore } from "@microservices-sh/forms-intake/ports";
import type { BookingRepository } from "@microservices-sh/booking/ports";
import type { AccountingCoreStore } from "@microservices-sh/accounting-core";
import type { AccountsPayableStore } from "@microservices-sh/accounts-payable";
import type { AccountsReceivableService } from "@microservices-sh/accounts-receivable";
import type { BankReconciliationService } from "@microservices-sh/bank-reconciliation";

declare global {
  namespace App {
    interface Platform {
      context?: ExecutionContext;
      env?: {
        DB?: D1Database;
        MEDIA_BUCKET?: R2Bucket;
        RATE_LIMIT_KV?: KVNamespace;
        JOB_QUEUE?: Queue<{ jobId: string }>;
        STRIPE_SECRET_KEY?: string;
        IMAGE_BUCKET?: R2Bucket;
        DESKTOP_IMPORT_TOKEN?: string;
        DESKTOP_IMPORT_ALLOWED_ORIGIN?: string;
        // Optional Workers Analytics Engine dataset for per-request data points.
        // Absent by default — the observability sink no-ops without it.
        OBSERVABILITY?: AnalyticsEngineDataset;
        KIEAI_API_KEY?: string;
        KIEAI_BASE_URL?: string;
        GEMINI_ENDPOINT?: string;
        GEMINI_AUTH_TOKEN?: string;
        OPENAI_API_KEY?: string;
        GPT_IMAGE_BASE_URL?: string;
        GPT_IMAGE_MODEL?: string;
        MICROSERVICES_DEPLOYMENT_ID?: string;
        MICROSERVICES_OBSERVABILITY_TOKEN?: string;
        MICROSERVICES_OBSERVABILITY_URL?: string;
        MICROSERVICES_TEMPLATE_ID?: string;
        MICROSERVICES_WORKER_NAME?: string;
      };
    }

    interface Locals {
      rbacStore: RbacStore;
      tableGateway: TableGateway;
      auditStore: AuditEventStore;
      signingKeyStore: SigningKeyStore;
      customerRepository: CustomerRepository;
      ticketStore: TicketStore;
      invoiceStore: InvoiceStore;
      numberAllocator: NumberAllocator;
      mediaStore: MediaStore;
      objectStorage: ObjectStorage;
      notificationStore: NotificationStore;
      jobStore: JobStore;
      scheduleStore: ScheduleStore;
      jobQueue?: QueueProducer;
      webhookEndpointStore: WebhookEndpointStore;
      webhookDeliveryLog: DeliveryLogStore;
      // Passwordless identity stores (@microservices-sh/identity): accounts,
      // one-time login codes, and server-side sessions.
      accountStore: AccountStore;
      loginCodeStore: LoginCodeStore;
      sessionStore: SessionStore;
      // Fixed-window rate limiter (KV-backed in prod, memory locally).
      rateLimitStore: RateLimitStore;
      // Payments: D1/memory repository + Stripe/memory gateway.
      paymentRepository: PaymentRepository;
      paymentGateway: PaymentGateway;
      billingStore: BillingStore;
      // Image generation: store + object storage (R2/memory) + provider registry.
      imageStore: ImageStore;
      imageStorage: ImageObjectStorage;
      imageProviders: ProviderRegistry;
      adsStore: AdsStore;
      formStore: FormStore;
      bookingRepository: BookingRepository;
      accountingCoreStore: AccountingCoreStore;
      accountsPayableStore: AccountsPayableStore;
      accountsReceivableService: AccountsReceivableService;
      bankReconciliationService: BankReconciliationService;
      // The signed-in principal, resolved from the session store each request.
      // isSuperAdmin is derived from the account's isAdmin flag, never the cookie.
      user: { id: string; email: string; isSuperAdmin: boolean } | null;
      // Per-request observability context, set by the request hook so handleError
      // can correlate runtime errors with the request log line. Optional — absent
      // until the hook assigns it.
      requestId?: string;
      tenantId?: string | null;
    }
  }
}

export {};
