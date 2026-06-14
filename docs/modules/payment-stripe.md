# Stripe Payment Module

Status: `planned`

Class: `provider`

Mount: `/payments`

## Purpose

The Stripe Payment module provides a full Stripe implementation for payment workflows. It is not only credential storage. It should generate and maintain the app logic for products, prices, checkout sessions, payment links, webhook verification, payment status tracking, refunds, and payment-related events.

## When To Use

- Use when a generated app needs Stripe checkout, deposits, one-time payments, subscriptions, payment links, receipts, refunds, or payment webhooks.
- Use when modules such as Booking, Order, Invoice, or Subscription need real payment lifecycle state.

## When Not To Use

- Do not use when the user only wants manual/offline payment tracking.
- Do not use for marketplace split payments in the MVP.
- Do not use for PCI-sensitive raw card collection. The default should use Stripe-hosted checkout or payment links.

## Dependencies

| Dependency | Required | Reason |
|------------|----------|--------|
| `auth` | Yes | Admin/actor identity for payment actions. |
| `customer` | Yes | Stripe customer mapping. |
| D1 binding `DB` | Yes | Stores payment records and webhook events. |
| Queue `PAYMENT_QUEUE` | Recommended | Async webhook processing and reconciliation. |
| `audit-log` | Optional | Detailed payment audit trail. |
| `email` | Optional | Receipts and payment notifications. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 table | `payment_customers` | Yes | Maps local customers to Stripe customers. |
| D1 table | `payment_products` | Yes | Maps local products/services to Stripe products/prices. |
| D1 table | `payment_sessions` | Yes | Tracks checkout sessions and payment links. |
| D1 table | `payment_events` | Yes | Idempotent webhook event log. |
| Queue | `PAYMENT_QUEUE` | Recommended | Handles webhooks outside the request path. |
| Outbound fetch | `api.stripe.com` | Yes | Stripe API calls. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `STRIPE_SECRET_KEY` | Secret | module/env | Yes | Stripe API secret key. Separate test and live keys. |
| `STRIPE_WEBHOOK_SECRET` | Secret | module/env | Yes | Used to verify Stripe webhook signatures. |
| `STRIPE_MODE` | Var | module/env | Yes | `test` or `live`. |
| `APP_URL` | Var | project/env | Yes | Used to build success/cancel URLs. |

Secrets should be per project, per environment, and per module instance by default. Shared Stripe credentials require explicit user approval.

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `payment.read` | Read payment records and status. |
| `payment.write` | Create sessions, payment links, refunds, and sync records. |
| `payment.admin` | Change products, prices, webhook configuration, and live-mode settings. |

Risk level: `high`

Approval required for:

- installing the module
- entering or changing Stripe secrets
- creating products/prices in Stripe
- creating or changing webhooks
- switching from test to live mode
- refunding payments
- running migrations
- production deployment

## Routes

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `POST` | `/payments/stripe/customers` | Required | `payment.write` | Create or sync a Stripe customer. |
| `POST` | `/payments/stripe/products` | Required | `payment.admin` | Create or sync Stripe product and price records. |
| `POST` | `/payments/checkout` | Required or public by config | `payment.write` | Create a Stripe checkout session. |
| `POST` | `/payments/payment-link` | Required | `payment.write` | Create a Stripe payment link. |
| `GET` | `/payments/:id` | Required | `payment.read` | Read local payment status. |
| `POST` | `/payments/:id/refund` | Required | `payment.admin` | Create a refund or mark manual refund. |
| `POST` | `/webhooks/stripe` | Stripe signed | Internal | Verify and process Stripe webhooks. |

## Payloads And Responses

### Create Product And Price

Request:

```json
{
  "name": "Consultation Deposit",
  "description": "Deposit for a consultation booking",
  "unitAmount": 5000,
  "currency": "usd",
  "metadata": {
    "serviceId": "svc_123"
  }
}
```

Response:

```json
{
  "ok": true,
  "product": {
    "id": "prod_123",
    "priceId": "price_123",
    "name": "Consultation Deposit",
    "unitAmount": 5000,
    "currency": "usd"
  }
}
```

### Create Checkout Session

Request:

```json
{
  "customerId": "cus_123",
  "lineItems": [
    {
      "priceId": "price_123",
      "quantity": 1
    }
  ],
  "successUrl": "https://app.example.com/bookings/bok_123/success",
  "cancelUrl": "https://app.example.com/bookings/bok_123/cancel",
  "metadata": {
    "bookingId": "bok_123"
  }
}
```

Response:

```json
{
  "ok": true,
  "checkout": {
    "id": "cs_test_123",
    "url": "https://checkout.stripe.com/c/pay/cs_test_123",
    "status": "open"
  }
}
```

### Stripe Webhook

Request:

```json
{
  "id": "evt_123",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_123",
      "payment_status": "paid"
    }
  }
}
```

Response:

```json
{
  "ok": true,
  "received": true
}
```

The real webhook route must verify `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET` before parsing or trusting the event.

## Events

### Emits

| Event | Payload | Purpose |
|-------|---------|---------|
| `payment.customer_synced` | `customerId`, `stripeCustomerId` | Notify dependent modules of customer mapping. |
| `payment.checkout_created` | `paymentId`, `checkoutSessionId`, `url` | Store or present payment URL. |
| `payment.succeeded` | `paymentId`, `customerId`, `amount`, `metadata` | Confirm booking/order/invoice. |
| `payment.failed` | `paymentId`, `customerId`, `reason` | Trigger retry or user notification. |
| `payment.refunded` | `paymentId`, `amount` | Update downstream records. |

### Consumes

| Event | Action |
|-------|--------|
| `booking.created` | Optionally create a deposit checkout. |
| `order.created` | Create checkout for order payment. |
| `invoice.issued` | Create payment link for invoice. |

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `beforeCheckoutCreate` | Pre | local checkout request | modified request or validation error | Add metadata, enforce payment rules. |
| `mapLineItems` | Compute | booking/order/invoice context | Stripe line items | Customize price mapping. |
| `afterPaymentSucceeded` | Post | payment event | side effects only | Confirm booking, send receipt, sync CRM. |
| `beforeRefundCreate` | Pre | refund request | modified request or validation error | Enforce refund policy. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `payment_customers` | Maps local customer ids to Stripe customer ids. |
| `payment_products` | Tracks local product/service to Stripe product/price ids. |
| `payment_sessions` | Tracks checkout sessions, payment links, and payment status. |
| `payment_events` | Stores Stripe webhook events for idempotency and replay. |

## Customization

Preferred order:

1. Config: mode, currency, success/cancel URLs, allowed payment methods.
2. Hooks: line item mapping, checkout metadata, refund policy.
3. Overlay: custom payment route behavior.
4. Fork: unusual Stripe flows or marketplace payments.

## Upgrade Notes

- Never edit webhook verification logic casually; treat it as security-sensitive.
- Keep payment rules in hooks to preserve upgradeability.
- Product/price creation changes should be idempotent and logged.
- Live-mode switch requires explicit approval and audit record.

## Failure Modes

| Failure | Cause | Agent Remediation |
|---------|-------|-------------------|
| Missing Stripe secret | `STRIPE_SECRET_KEY` not configured | Ask user to add secret in secure UI. |
| Webhook verification failed | Wrong or missing `STRIPE_WEBHOOK_SECRET` | Verify webhook endpoint and secret. |
| Duplicate webhook event | Stripe retry or replay | Use `payment_events` idempotency table and return success. |
| Checkout creation failed | Invalid price/customer/mode | Inspect local mapping and Stripe mode. |
| Live mode blocked | Approval gate not satisfied | Request explicit user approval. |

## Agent Checklist

- Confirm test vs live mode.
- Confirm required secrets are configured, without reading values.
- Confirm webhook endpoint and signature verification.
- Confirm product/price mapping.
- Confirm downstream module event handling.
- Run checkout and webhook tests in Stripe test mode before preview.

