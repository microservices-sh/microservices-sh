import { billPaymentIdentitySchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function getBillPayment(input: unknown, deps: AccountsPayableDeps) {
  const parsed = billPaymentIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "accounts-payable.INVALID_PAYMENT_IDENTITY",
      "Bill payment identity is invalid.",
      deps,
      parsed.error.issues
    );
  }

  const payment = await deps.accountsPayableStore.getPayment(parsed.data.tenantId, parsed.data.paymentId);
  if (!payment) {
    return err(404, "accounts-payable.PAYMENT_NOT_FOUND", "Bill payment not found.", deps);
  }

  return ok(200, { payment }, deps);
}
