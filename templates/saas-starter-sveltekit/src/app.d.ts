import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { BillingStore } from "@microservices-sh/billing-subscriptions/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";

declare global {
  namespace App {
    interface Platform {
      context?: ExecutionContext;
      env?: {
        DB?: D1Database;
        MICROSERVICES_DEPLOYMENT_ID?: string;
        MICROSERVICES_OBSERVABILITY_TOKEN?: string;
        MICROSERVICES_OBSERVABILITY_URL?: string;
        MICROSERVICES_TEMPLATE_ID?: string;
        MICROSERVICES_WORKER_NAME?: string;
      };
    }

    interface Locals {
      rbacStore: RbacStore;
      billingStore: BillingStore;
      tableGateway: TableGateway;
      auditStore: AuditEventStore;
      signingKeyStore: SigningKeyStore;
      // The signed-in principal. In this starter the session user is a demo
      // identity; wire @microservices-sh/auth verifyToken for real sessions.
      user: { id: string; email: string; isSuperAdmin: boolean } | null;
    }
  }
}

export {};
