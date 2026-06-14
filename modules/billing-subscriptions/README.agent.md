# Agent Guide: Billing & Subscriptions Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, the Stripe
   SDK, or app route code. The host normalizes Stripe events into
   `NormalizedBillingEvent` before calling `applyStripeEvent`.
2. Put persistence behind `BillingStore`. Never make real I/O in tests — use
   `createMemoryBillingStore()`.
3. Preserve the correctness invariants — they are the reason this module exists:
   - **Full status machine**: keep `mapStripeStatus` covering every Stripe status
     (incl. past_due/unpaid/paused/incomplete). Unknown statuses must default to a
     non-access state, never "active".
   - **Idempotent webhooks**: keep the `recordEventKey` dedup in `applyStripeEvent`
     (look up the subscription first so an early event can retry).
   - **Idempotent usage**: keep the `recordUsageKey` dedup in `recordUsage`.
   - **Access derives from status** via `grantsAccess`, not ad-hoc checks.
4. Risk `high`: migrations, money mutations, and production deploy are approval-gated.
5. Run `pnpm --filter @microservices-sh/billing-subscriptions build` and `check:spec` after edits.
