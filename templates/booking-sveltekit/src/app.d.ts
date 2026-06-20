import type { BookingRepository } from "@microservices-sh/booking/ports";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { TokenClaims } from "@microservices-sh/auth/types";
import type { ApiKeyStore, RateLimitStore, TokenMinter } from "@microservices-sh/gateway/ports";

declare global {
  namespace App {
    interface Platform {
      context?: ExecutionContext;
      env?: {
        DB?: D1Database;
        CACHE_KV?: KVNamespace;
        RATE_LIMIT_KV?: KVNamespace;
        MICROSERVICES_DEPLOYMENT_ID?: string;
        MICROSERVICES_OBSERVABILITY_TOKEN?: string;
        MICROSERVICES_OBSERVABILITY_URL?: string;
        MICROSERVICES_TEMPLATE_ID?: string;
        MICROSERVICES_WORKER_NAME?: string;
        /** Shared secret gating the one-time /api/auth/bootstrap route. */
        BOOTSTRAP_TOKEN?: string;
        /** Optional bearer token gating scheduled endpoints (/api/holds/expire, /api/cron/run). */
        CRON_TOKEN?: string;
        /** Email: set to send via Resend; unset falls back to a console provider (dev). */
        RESEND_API_KEY?: string;
        /** From-address for outbound email. */
        EMAIL_FROM?: string;
        /** Payments: set to charge via Stripe; unset uses a memory gateway (dev). */
        STRIPE_SECRET_KEY?: string;
        /** Stripe webhook signing secret for /api/payments/webhook. */
        STRIPE_WEBHOOK_SECRET?: string;
        /** Per-tenant secret verifying the Hermes agent's ops read-back token (Plan 32, /ops). */
        OPS_VERIFY_SECRET?: string;
      };
    }

    interface Locals {
      bookingRepository: BookingRepository;
      customerRepository: CustomerRepository;
      signingKeyStore: SigningKeyStore;
      apiKeyStore: ApiKeyStore;
      rateLimitStore: RateLimitStore;
      tokenMinter: TokenMinter;
      claims: TokenClaims | null;
      user: { id: string; email: string; isAdmin: boolean } | null;
    }
  }
}

export {};
