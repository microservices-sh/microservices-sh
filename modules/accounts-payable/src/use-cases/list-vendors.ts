import { listVendorsInputSchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function listVendors(input: unknown, deps: AccountsPayableDeps) {
  const parsed = listVendorsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_VENDOR_FILTER", "Vendor filter is invalid.", deps, parsed.error.issues);
  }

  const vendors = await deps.accountsPayableStore.listVendors(parsed.data);
  return ok(200, { vendors, count: vendors.length }, deps);
}
