# Agent Guide: Payment Module

Read `module.json`, `llms.txt`, `plans/24-service-topology-and-auth-comms.md`, and
`src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `PaymentRepository` and Stripe behind `PaymentGateway`.
   Keep provider HTTP only in `src/adapters/stripe-payment-gateway.ts`.
3. Never call real Stripe in tests — inject `createMemoryPaymentGateway()` and
   `createMemoryPaymentRepository()`.
4. Always verify the Stripe webhook signature (`verifyWebhookSignature`) before
   acting on an event. The verification is HMAC-SHA256, constant-time.
5. This is a provider module (risk `high`): secrets, migrations, external
   side-effects, and production deploy are approval-gated.
6. Run `pnpm --filter @microservices-sh/payment build` and
   `pnpm spec:check -- module modules/payment` after edits.
