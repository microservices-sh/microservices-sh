import { billIdentitySchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function getBill(input: unknown, deps: AccountsPayableDeps) {
  const parsed = billIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "accounts-payable.INVALID_BILL_IDENTITY",
      "Bill identity is invalid.",
      deps,
      parsed.error.issues
    );
  }

  const bill = await deps.accountsPayableStore.getBill(parsed.data.tenantId, parsed.data.billId);
  if (!bill) {
    return err(404, "accounts-payable.BILL_NOT_FOUND", "Bill not found.", deps);
  }

  return ok(200, { bill }, deps);
}
