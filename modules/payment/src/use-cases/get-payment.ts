import { getPaymentInputSchema } from "../schemas";
import type { PaymentRepository } from "../ports";

// Read one payment by id. Requires payment.read at the route layer.
export async function getPayment(input: unknown, deps: { paymentRepository: PaymentRepository }) {
  const parsed = getPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_PAYMENT_INPUT", message: "Payment lookup input is invalid.", issues: parsed.error.issues }
    };
  }
  const payment = await deps.paymentRepository.getById(parsed.data.id);
  if (!payment) {
    return { ok: false as const, status: 404 as const, error: { code: "PAYMENT_NOT_FOUND", message: "Payment not found." } };
  }
  return { ok: true as const, status: 200 as const, data: { payment } };
}
