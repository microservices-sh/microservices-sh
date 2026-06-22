import { updateVendorStatusInputSchema } from "../schemas";
import { isoNow } from "../service";
import type { AccountsPayableEvent } from "../types";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function updateVendorStatus(input: unknown, deps: AccountsPayableDeps) {
  const parsed = updateVendorStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_VENDOR_STATUS", "Vendor status update is invalid.", deps, parsed.error.issues);
  }

  const vendor = await deps.accountsPayableStore.getVendor(parsed.data.tenantId, parsed.data.vendorId);
  if (!vendor) {
    return err(404, "accounts-payable.VENDOR_NOT_FOUND", "Vendor not found.", deps);
  }

  const updated = { ...vendor, active: parsed.data.active, updatedAt: isoNow(deps.now) };
  await deps.accountsPayableStore.updateVendor(updated);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.vendor_status_updated",
    entityType: "accounts-payable",
    entityId: updated.id,
    tenantId: updated.tenantId,
    payload: { active: updated.active }
  };
  await deps.accountsPayableStore.writeEvent(event);

  return ok(200, { vendor: updated, event }, deps);
}
