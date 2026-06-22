import { updateVendorInputSchema } from "../schemas";
import { isoNow, normalizeCurrency, normalizeOptional } from "../service";
import type { AccountsPayableEvent, Vendor } from "../types";
import { err, ok, validateExternalPair, type AccountsPayableDeps } from "./shared";

function applyVendorUpdate(existing: Vendor, input: ReturnType<typeof updateVendorInputSchema.parse>, now: string): Vendor {
  return {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    email: input.email !== undefined ? input.email ?? null : existing.email,
    phone: input.phone !== undefined ? normalizeOptional(input.phone) : existing.phone,
    addressLine1: input.addressLine1 !== undefined ? normalizeOptional(input.addressLine1) : existing.addressLine1,
    city: input.city !== undefined ? normalizeOptional(input.city) : existing.city,
    state: input.state !== undefined ? normalizeOptional(input.state) : existing.state,
    postalCode: input.postalCode !== undefined ? normalizeOptional(input.postalCode) : existing.postalCode,
    country: input.country !== undefined ? normalizeOptional(input.country) : existing.country,
    taxId: input.taxId !== undefined ? normalizeOptional(input.taxId) : existing.taxId,
    is1099Vendor: input.is1099Vendor !== undefined ? input.is1099Vendor : existing.is1099Vendor,
    defaultExpenseAccountId:
      input.defaultExpenseAccountId !== undefined
        ? normalizeOptional(input.defaultExpenseAccountId)
        : existing.defaultExpenseAccountId,
    defaultPaymentTermsDays:
      input.defaultPaymentTermsDays !== undefined ? input.defaultPaymentTermsDays : existing.defaultPaymentTermsDays,
    currency: input.currency !== undefined ? normalizeCurrency(input.currency) : existing.currency,
    externalId: input.externalId !== undefined ? normalizeOptional(input.externalId) : existing.externalId,
    externalSource: input.externalSource !== undefined ? normalizeOptional(input.externalSource) : existing.externalSource,
    notes: input.notes !== undefined ? input.notes ?? null : existing.notes,
    updatedAt: now
  };
}

export async function updateVendor(input: unknown, deps: AccountsPayableDeps) {
  const parsed = updateVendorInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_VENDOR_UPDATE", "Vendor update is invalid.", deps, parsed.error.issues);
  }

  const existing = await deps.accountsPayableStore.getVendor(parsed.data.tenantId, parsed.data.vendorId);
  if (!existing) {
    return err(404, "accounts-payable.VENDOR_NOT_FOUND", "Vendor not found.", deps);
  }

  const now = isoNow(deps.now);
  const vendor = applyVendorUpdate(existing, parsed.data, now);
  const externalError = validateExternalPair(vendor.externalSource, vendor.externalId, deps);
  if (externalError) return externalError;
  if (vendor.externalId && vendor.externalSource) {
    const conflict = await deps.accountsPayableStore.findVendorByExternalRef(
      vendor.tenantId,
      vendor.externalSource,
      vendor.externalId
    );
    if (conflict && conflict.id !== vendor.id) {
      return err(409, "accounts-payable.EXTERNAL_VENDOR_CONFLICT", "A vendor already uses this external reference.", deps);
    }
  }

  await deps.accountsPayableStore.updateVendor(vendor);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.vendor_updated",
    entityType: "accounts-payable",
    entityId: vendor.id,
    tenantId: vendor.tenantId,
    payload: { name: vendor.name, active: vendor.active }
  };
  await deps.accountsPayableStore.writeEvent(event);

  return ok(200, { vendor, event }, deps);
}
