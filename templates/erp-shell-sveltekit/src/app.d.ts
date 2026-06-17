import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import type { InvoiceStore, NumberAllocator } from "@microservices-sh/invoice/ports";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import type { NotificationStore } from "@microservices-sh/notifications-inapp/ports";
import type { JobStore } from "@microservices-sh/jobs-workflows/ports";

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
      invoiceStore: InvoiceStore;
      numberAllocator: NumberAllocator;
      mediaStore: MediaStore;
      objectStorage: ObjectStorage;
      notificationStore: NotificationStore;
      jobStore: JobStore;
      // The signed-in principal. In this ERP shell the session user is a demo
      // identity; wire @microservices-sh/identity (passwordless email-code →
      // verifyLoginCode/readSession) for real employee sessions.
      user: { id: string; email: string; isSuperAdmin: boolean } | null;
    }
  }
}

export {};
