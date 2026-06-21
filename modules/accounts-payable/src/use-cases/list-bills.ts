import { listBillsInputSchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function listBills(input: unknown, deps: AccountsPayableDeps) {
  const parsed = listBillsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_BILL_FILTER", "Bill filter is invalid.", deps, parsed.error.issues);
  }

  const bills = await deps.accountsPayableStore.listBills(parsed.data);
  return ok(200, { bills, count: bills.length }, deps);
}
