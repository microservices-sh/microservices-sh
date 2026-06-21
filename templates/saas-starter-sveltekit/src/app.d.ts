import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { BillingStore } from "@microservices-sh/billing-subscriptions/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { AccountStore, LoginCodeStore, SessionStore } from "@microservices-sh/identity";
import type { RateLimitStore } from "@microservices-sh/gateway/ports";
import type { PaymentRepository, PaymentGateway } from "@microservices-sh/payment/ports";

declare global {
  namespace App {
    interface Platform {
      context?: ExecutionContext;
      env?: {
        DB?: D1Database;
        RATE_LIMIT_KV?: KVNamespace;
        ADMIN_EMAILS?: string;
        RESEND_API_KEY?: string;
        EMAIL_FROM?: string;
        STRIPE_SECRET_KEY?: string;
        STRIPE_WEBHOOK_SECRET?: string;
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
      accountStore: AccountStore;
      loginCodeStore: LoginCodeStore;
      sessionStore: SessionStore;
      rateLimitStore: RateLimitStore;
      paymentRepository: PaymentRepository;
      paymentGateway: PaymentGateway;
      // The signed-in principal, resolved from the server-side identity session.
      // Platform admins come from ADMIN_EMAILS, never a client-supplied cookie.
      user: { id: string; email: string; isSuperAdmin: boolean } | null;
    }
  }
}

export {};
