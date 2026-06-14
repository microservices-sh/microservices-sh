import { afterPaymentSucceeded } from "../hooks";
import { verifyWebhookSignature } from "../webhook";
import type { PaymentRepository } from "../ports";
import type { DomainEvent, PaymentStatus } from "../types";

// Map Stripe event types to our payment status + emitted domain event.
const EVENT_MAP: Record<string, { status: PaymentStatus; event: string }> = {
  "payment_intent.succeeded": { status: "succeeded", event: "payment.succeeded" },
  "charge.refunded": { status: "refunded", event: "payment.refunded" },
  "payment_intent.payment_failed": { status: "failed", event: "payment.failed" }
};

// Verify a Stripe webhook signature, then update the matching payment record and
// emit the corresponding domain event. Rejects tampered or unsigned payloads.
export async function handleWebhook(
  rawBody: string,
  signatureHeader: string,
  deps: { paymentRepository: PaymentRepository; webhookSecret: string; now?: () => number }
) {
  const valid = await verifyWebhookSignature(rawBody, signatureHeader, deps.webhookSecret);
  if (!valid) {
    return { ok: false as const, status: 401 as const, error: { code: "INVALID_SIGNATURE", message: "Webhook signature is invalid." } };
  }

  let parsed: { type?: string; data?: { object?: { id?: string; payment_intent?: string } } };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false as const, status: 400 as const, error: { code: "INVALID_WEBHOOK_BODY", message: "Webhook body is not valid JSON." } };
  }

  const type = parsed.type ?? "";
  const mapping = EVENT_MAP[type];
  if (!mapping) {
    return { ok: true as const, status: 200 as const, data: { ignored: true, type } };
  }

  const object = parsed.data?.object ?? {};
  const intentId = object.payment_intent ?? object.id ?? "";
  if (!intentId) {
    return { ok: false as const, status: 400 as const, error: { code: "MISSING_INTENT", message: "Webhook event has no payment intent id." } };
  }

  const updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  const payment = await deps.paymentRepository.updateStatus(intentId, mapping.status, updatedAt);
  if (!payment) {
    return { ok: false as const, status: 404 as const, error: { code: "PAYMENT_NOT_FOUND", message: "No payment matches the webhook intent id." } };
  }

  if (mapping.status === "succeeded") {
    await afterPaymentSucceeded(payment);
  }

  const event: DomainEvent = {
    name: mapping.event,
    payload: { paymentId: payment.id, intentId: payment.intentId, customerId: payment.customerId, status: payment.status }
  };

  return { ok: true as const, status: 200 as const, data: { payment, event } };
}
