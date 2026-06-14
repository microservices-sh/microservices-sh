import type { PaymentGateway } from "../ports";

// In-memory gateway for tests. Returns deterministic intent ids without any
// network call, so payment use cases can be exercised without Stripe.
export function createMemoryPaymentGateway(): PaymentGateway {
  let counter = 0;
  return {
    async createIntent() {
      counter += 1;
      const intentId = `pi_test_${counter}`;
      return { intentId, clientSecret: `${intentId}_secret_test`, status: "requires_payment_method" };
    }
  };
}
