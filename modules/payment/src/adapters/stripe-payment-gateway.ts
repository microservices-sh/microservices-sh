import type { PaymentGateway } from "../ports";
import type { GatewayIntent } from "../types";

// Stripe adapter for the PaymentGateway port. Framework-neutral: uses global
// fetch to call api.stripe.com. Never imported by tests — tests use the memory
// gateway so they make no network calls.
export function createStripePaymentGateway(secretKey: string): PaymentGateway {
  return {
    async createIntent(input) {
      const body = new URLSearchParams();
      body.set("amount", String(input.amount));
      body.set("currency", input.currency);
      if (input.customerId) body.set("metadata[customerId]", input.customerId);
      if (input.description) body.set("description", input.description);

      const response = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Stripe payment_intents failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as { id: string; client_secret: string; status: string };
      const intent: GatewayIntent = {
        intentId: data.id,
        clientSecret: data.client_secret,
        status: data.status
      };
      return intent;
    },
    async refund(intentId) {
      const body = new URLSearchParams();
      body.set("payment_intent", intentId);

      const response = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Stripe refunds failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as { status: string };
      return { status: data.status };
    }
  };
}
