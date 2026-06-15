import { z } from "zod";
import type { PaymentGateway, PaymentRepository } from "../ports";

const refundInputSchema = z.object({ intentId: z.string().min(1) });

// Refund a payment by its intent id: ask the gateway to refund, then mark the
// record refunded. Idempotent-ish — a second call returns 409. Requires
// payment.write at the route layer.
export async function refundPayment(
  input: unknown,
  deps: { paymentRepository: PaymentRepository; paymentGateway: PaymentGateway; now?: () => number },
) {
  const parsed = refundInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_REFUND_INPUT", message: "Refund input is invalid.", issues: parsed.error.issues },
    };
  }

  const existing = await deps.paymentRepository.getByIntentId(parsed.data.intentId);
  if (!existing) {
    return { ok: false as const, status: 404 as const, error: { code: "PAYMENT_NOT_FOUND", message: "Payment not found." } };
  }
  if (existing.status === "refunded") {
    return { ok: false as const, status: 409 as const, error: { code: "ALREADY_REFUNDED", message: "Payment is already refunded." } };
  }

  await deps.paymentGateway.refund(parsed.data.intentId);
  const now = new Date(deps.now ? deps.now() : Date.now()).toISOString();
  const updated = await deps.paymentRepository.updateStatus(parsed.data.intentId, "refunded", now);

  return { ok: true as const, status: 200 as const, data: { payment: updated } };
}
