# Billing & Subscriptions Module

Status: `available` (v0.1.0) · Class: `provider` · Risk: `high`

Recurring plans and subscription state for Cloudflare Workers + D1, layered on
Stripe. Turns the one-off `payment` module into a monetization stack. It
encapsulates the subscription bugs AI agents reliably ship:

1. **Full status state machine** — `trialing | active | past_due | unpaid | paused
   | canceled`. Every Stripe status maps to one of these (`state.ts`); modeling
   only active/canceled is how generated billing corrupts state and mis-provisions.
2. **Idempotent webhooks** — `applyStripeEvent` records each event id once; a
   redelivered webhook is a no-op (no double-provision, no double receipt).
3. **Plan changes & cancel** — `changePlan`, `cancelSubscription` (at-period-end
   by default).
4. **Metered usage + dunning** — idempotent `recordUsage`; `dueForDunning` surfaces
   `past_due` subscriptions for retry via jobs-workflows.

## Flow

```ts
import {
  createPlan, startSubscription, applyStripeEvent, changePlan, dueForDunning,
  grantsAccess, createD1BillingStore
} from "@microservices-sh/billing-subscriptions";

const store = createD1BillingStore(env.DB);

const pro = await createPlan({ name: "Pro", priceCents: 9900, interval: "month" }, { store });
const sub = await startSubscription({ subscriberId: org.id, planId: pro.data.id, trialDays: 14 }, { store });

// in the Stripe webhook route (host normalizes the event first):
await applyStripeEvent(
  { id: stripeEvent.id, type: stripeEvent.type, stripeSubscriptionId, stripeStatus, periodStart, periodEnd },
  { store }
);

// access check:
const s = await store.getSubscription(sub.data.id);
if (s && grantsAccess(s.status)) allow();
```

## Resources

- D1 (`DB`): `plans`, `subscriptions`, `billing_events` (idempotency), `usage_records` (migration `0001`).

## Verification

```bash
pnpm --filter @microservices-sh/billing-subscriptions build
pnpm --filter @microservices-sh/billing-subscriptions check:spec
```
