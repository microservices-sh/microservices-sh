import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import type { TicketStore } from "@microservices-sh/support-ticket/ports";
import type { InvoiceStore, NumberAllocator } from "@microservices-sh/invoice/ports";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import type { NotificationStore } from "@microservices-sh/notifications-inapp/ports";
import type { JobStore } from "@microservices-sh/jobs-workflows/ports";
import type { AccountStore, LoginCodeStore, SessionStore } from "@microservices-sh/identity";

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
      // Passwordless identity stores (@microservices-sh/identity): accounts,
      // one-time login codes, and server-side sessions.
      accountStore: AccountStore;
      loginCodeStore: LoginCodeStore;
      sessionStore: SessionStore;
      // The signed-in principal, resolved from the session store each request.
      // isSuperAdmin is derived from the account's isAdmin flag, never the cookie.
      user: { id: string; email: string; isSuperAdmin: boolean } | null;
    }
  }
}

export {};
