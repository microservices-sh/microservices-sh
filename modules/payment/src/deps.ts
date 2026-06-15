/* ─────────────────────────────────────────────────────────────────────────
   Dependency factory for the payment use cases.

   The payment use cases take two injected ports: a PaymentRepository (records)
   and a PaymentGateway (provider). This factory wires the standard adapters in
   one place — D1 + Stripe when their bindings/secrets are present (production),
   in-memory otherwise (local dev / tests) — so route adapters and tests don't
   each re-implement the same selection.
   ───────────────────────────────────────────────────────────────────────── */
import { createD1PaymentRepository } from "./adapters/d1-payment-repository";
import { createMemoryPaymentRepository } from "./adapters/memory-payment-repository";
import { createStripePaymentGateway } from "./adapters/stripe-payment-gateway";
import { createMemoryPaymentGateway } from "./adapters/memory-payment-gateway";
import type { PaymentGateway, PaymentRepository } from "./ports";

export interface PaymentDeps {
  paymentRepository: PaymentRepository;
  paymentGateway: PaymentGateway;
}

// The in-memory repository is stateful; keep a singleton so a payment created in
// one call is still findable in the next (within a process) — e.g. a deposit
// created at booking time must be present to refund on cancel.
let memoryRepo: PaymentRepository | null = null;

/**
 * Build the payment repository + gateway dependencies.
 *
 * @param env Optional environment. `DB` (a Cloudflare D1 binding) selects D1
 *            persistence; `STRIPE_SECRET_KEY` selects the Stripe gateway. Omit
 *            either to fall back to the in-memory adapter (no network, no DB).
 */
export function createPaymentDeps(env?: { DB?: D1Database; STRIPE_SECRET_KEY?: string }): PaymentDeps {
  const paymentRepository = env?.DB
    ? createD1PaymentRepository(env.DB)
    : (memoryRepo ??= createMemoryPaymentRepository());
  const paymentGateway = env?.STRIPE_SECRET_KEY
    ? createStripePaymentGateway(env.STRIPE_SECRET_KEY)
    : createMemoryPaymentGateway();
  return { paymentRepository, paymentGateway };
}
