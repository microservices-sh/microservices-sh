# Payment

Status: available
Module ID: `payment`
Mount: `/payments`

## Summary
Stripe-backed payment provider: create payment intents, record payments, and verify signed Stripe webhooks. Emits payment lifecycle events.

## Dependencies
- auth
- customer

## Permissions
- payment.read
- payment.write
- payment.admin

## Secrets
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- beforeCreatePaymentIntent
- afterPaymentSucceeded

## Events
- payment.checkout_created
- payment.succeeded
- payment.refunded
- payment.failed

## Approval Gate
Risk: high

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
