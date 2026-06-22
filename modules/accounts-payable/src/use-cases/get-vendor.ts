import { vendorIdentitySchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function getVendor(input: unknown, deps: AccountsPayableDeps) {
  const parsed = vendorIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_VENDOR_IDENTITY", "Vendor identity is invalid.", deps, parsed.error.issues);
  }

  const vendor = await deps.accountsPayableStore.getVendor(parsed.data.tenantId, parsed.data.vendorId);
  if (!vendor) {
    return err(404, "accounts-payable.VENDOR_NOT_FOUND", "Vendor not found.", deps);
  }

  return ok(200, { vendor }, deps);
}
