import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { beforeCreatePaymentIntent } from "../hooks";
import { createPaymentIntentInputSchema } from "../schemas";
import { paymentMeta } from "../meta";
import type { PaymentGateway, PaymentRepository } from "../ports";
import type { DomainEvent, Payment } from "../types";

// Create a payment intent through the gateway and record a pending payment.
// Emits payment.checkout_created. Returns the client secret for the frontend.
//
// Two layers of customization run before the gateway call:
//   1. the local config seam `beforeCreatePaymentIntent` (per-app override)
//   2. the cross-module `beforeCreatePaymentIntent` hook chain (Plan 25 §5),
//      injected by the composed app via deps.beforeCreateHooks — filters may
//      mutate the input, guards may veto.
export async function createPaymentIntent(
  input: unknown,
  deps: {
    paymentRepository: PaymentRepository;
    paymentGateway: PaymentGateway;
    now?: () => number;
    correlationId?: string;
    beforeCreateHooks?: ResolvedHook[];
  }
) {
  const meta = paymentMeta(deps);

  const parsed = createPaymentIntentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "payment.INVALID_PAYMENT_INPUT", message: "Payment intent input is invalid.", issues: parsed.error.issues }, meta);
  }

  const configData = await beforeCreatePaymentIntent(parsed.data);
  const hooked = await runHooks(
    "beforeCreatePaymentIntent",
    configData,
    { correlationId: meta.correlationId },
    deps.beforeCreateHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
  }
  const data = hooked.value;

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
    correlationId: meta.correlationId,
    payload: { paymentId: payment.id, intentId: payment.intentId, customerId: payment.customerId, amount: payment.amount }
  };

  return ok(201, { payment, clientSecret: intent.clientSecret, event }, meta);
}
