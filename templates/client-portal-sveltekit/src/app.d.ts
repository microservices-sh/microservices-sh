import type { CustomerRepository } from "@microservices-sh/customer/ports";
import type { InvoiceStore, NumberAllocator } from "@microservices-sh/invoice/ports";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { TokenClaims } from "@microservices-sh/auth/types";
import type { AccountStore, LoginCodeStore, SessionStore } from "@microservices-sh/identity";
import type { RateLimitStore } from "@microservices-sh/gateway";

declare global {
  namespace App {
    interface Platform {
      context?: ExecutionContext;
      env?: {
        DB?: D1Database;
        MEDIA_BUCKET?: R2Bucket;
        MICROSERVICES_DEPLOYMENT_ID?: string;
        MICROSERVICES_OBSERVABILITY_TOKEN?: string;
        MICROSERVICES_OBSERVABILITY_URL?: string;
        MICROSERVICES_TEMPLATE_ID?: string;
        MICROSERVICES_TENANT_ID?: string;
        MICROSERVICES_WORKER_NAME?: string;
        RATE_LIMIT_KV?: KVNamespace;
        ADMIN_EMAILS?: string;
        RESEND_API_KEY?: string;
        EMAIL_FROM?: string;
      };
    }

    interface Locals {
      /** Tenant the current request operates within. */
      tenantId: string;
      customerRepository: CustomerRepository;
      invoiceStore: InvoiceStore;
      numberAllocator: NumberAllocator;
      mediaStore: MediaStore;
      objectStorage: ObjectStorage;
      auditStore: AuditEventStore;
      signingKeyStore: SigningKeyStore;
      claims: TokenClaims | null;
      accountStore: AccountStore;
      loginCodeStore: LoginCodeStore;
      sessionStore: SessionStore;
      rateLimitStore: RateLimitStore;
      /**
       * Resolved session principal. `role: "customer"` only sees its own
       * customerId-scoped data; `role: "staff"` sees the admin side.
       */
      user: {
        id: string;
        email: string;
        role: "customer" | "staff";
        customerId: string | null;
      } | null;
    }
  }
}

export {};
