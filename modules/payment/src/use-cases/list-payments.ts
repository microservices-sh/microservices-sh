import { listPaymentsFilterSchema } from "../schemas";
import type { PaymentRepository } from "../ports";

// List payments with optional filters. Requires payment.read at the route layer.
export async function listPayments(input: unknown, deps: { paymentRepository: PaymentRepository }) {
  const parsed = listPaymentsFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_PAYMENT_FILTER", message: "Payment filter is invalid.", issues: parsed.error.issues }
    };
  }
  const payments = await deps.paymentRepository.list(parsed.data);
  return { ok: true as const, status: 200 as const, data: { payments } };
}
