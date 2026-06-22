import { listBillPaymentsInputSchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function listBillPayments(input: unknown, deps: AccountsPayableDeps) {
  const parsed = listBillPaymentsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_PAYMENT_FILTER", "Bill payment filter is invalid.", deps, parsed.error.issues);
  }

  const payments = await deps.accountsPayableStore.listPayments(parsed.data);
  return ok(200, { payments, count: payments.length }, deps);
}
