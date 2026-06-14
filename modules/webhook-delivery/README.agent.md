# Agent Guide: Webhook Delivery Module

Read `module.json`, `llms.txt`, `plans/24-service-topology-and-auth-comms.md`, and
`src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `WebhookEndpointStore` / `DeliveryLogStore` and all
   outbound HTTP behind the `HttpClient` port.
3. Never make real network calls in tests — inject `createMemoryHttpClient()`.
4. Always HMAC-sign the outbound body with the per-endpoint secret
   (`signPayload`). Treat non-2xx responses as failed.
5. Keep the delivery log append-only.
6. This is a sink module (risk `high`): migrations, external side-effects, and
   production deploy are approval-gated.
7. Run `pnpm --filter @microservices-sh/webhook-delivery build` and
   `pnpm spec:check -- module modules/webhook-delivery` after edits.
