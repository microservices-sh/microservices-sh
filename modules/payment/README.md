# Payment Module

The Stripe-backed payment provider for auth-gated apps (see
`plans/24-service-topology-and-auth-comms.md`, step 8). Creates payment intents,
records payments, and verifies inbound Stripe webhooks.

## What it does

- **Creates** a payment intent through the gateway and records a pending payment
  (`createPaymentIntent`, `payment.write`); emits `payment.checkout_created`.
- **Handles** Stripe webhooks (`handleWebhook`): verifies the Stripe signature
  (HMAC-SHA256, constant-time), then marks the payment
  `succeeded` / `refunded` / `failed` and emits the matching event.
- **Reads** payments (`getPayment`, `listPayments`, `payment.read`).

## Surface

| Use case | Scope | Purpose |
|----------|-------|---------|
| `createPaymentIntent` | `payment.write` | Create an intent + record pending payment (RPC method) |
| `handleWebhook` | none (Stripe signature) | Verify signature, update status, emit event |
| `getPayment` | `payment.read` | Read one payment |
| `listPayments` | `payment.read` | List payments with filters |

`signWebhook` / `verifyWebhookSignature` (HMAC-SHA256) are exported for the route
adapter and tests.

## Deps (ports)

- `PaymentRepository` — `createD1PaymentRepository(db)` / `createMemoryPaymentRepository()`.
- `PaymentGateway` — `createStripePaymentGateway(STRIPE_SECRET_KEY)` (real Stripe,
  uses fetch) / `createMemoryPaymentGateway()` (tests, no network).

## Secrets

- `STRIPE_SECRET_KEY` — used by the Stripe gateway adapter.
- `STRIPE_WEBHOOK_SECRET` — used to verify inbound webhook signatures.

## Security notes

- Provider module, approval risk `high`: treat secrets, migrations, external
  side-effects, and production deploy as approval-gated.
- Never call Stripe from tests; inject `createMemoryPaymentGateway()`.
- Always verify the webhook signature before trusting an event.
