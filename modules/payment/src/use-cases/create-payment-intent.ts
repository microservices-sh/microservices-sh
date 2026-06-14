import { beforeCreatePaymentIntent } from "../hooks";
import { createPaymentIntentInputSchema } from "../schemas";
import type { PaymentGateway, PaymentRepository } from "../ports";
import type { DomainEvent, Payment } from "../types";

// Create a payment intent through the gateway and record a pending payment.
// Emits payment.checkout_created. Returns the client secret for the frontend.
export async function createPaymentIntent(
  input: unknown,
  deps: { paymentRepository: PaymentRepository; paymentGateway: PaymentGateway; now?: () => number }
) {
  const parsed = createPaymentIntentInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_PAYMENT_INPUT", message: "Payment intent input is invalid.", issues: parsed.error.issues }
    };
  }

  const data = await beforeCreatePaymentIntent(parsed.data);
  const intent = await deps.paymentGateway.createIntent({
    amount: data.amount,
    currency: data.currency,
    customerId: data.customerId,
    description: data.description ?? null
  });

  const timestamp = new Date(deps.now?.() ?? Date.now()).toISOString();
  const payment: Payment = {
    id: "pay_" + crypto.randomUUID().slice(0, 16),
    intentId: intent.intentId,
    customerId: data.customerId,
    amount: data.amount,
    currency: data.currency,
    status: "pending",
    description: data.description ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await deps.paymentRepository.insert(payment);

  const event: DomainEvent = {
    name: "payment.checkout_created",
    payload: { paymentId: payment.id, intentId: payment.intentId, customerId: payment.customerId, amount: payment.amount }
  };

  return {
    ok: true as const,
    status: 201 as const,
    data: { payment, clientSecret: intent.clientSecret, event }
  };
}
