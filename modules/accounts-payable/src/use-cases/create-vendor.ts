import { createVendorInputSchema } from "../schemas";
import { accountsPayableId, isoNow, normalizeCurrency, normalizeOptional } from "../service";
import type { AccountsPayableEvent, Vendor } from "../types";
import { err, hooks, ok, validateExternalPair, type AccountsPayableDeps } from "./shared";

export async function createVendor(input: unknown, deps: AccountsPayableDeps) {
  const filtered = await hooks(deps).beforeVendorCreate(input);
  const parsed = createVendorInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_VENDOR_INPUT", "Vendor input is invalid.", deps, parsed.error.issues);
  }

  const externalId = normalizeOptional(parsed.data.externalId);
  const externalSource = normalizeOptional(parsed.data.externalSource);
  const externalError = validateExternalPair(externalSource, externalId, deps);
  if (externalError) return externalError;

  if (externalId && externalSource) {
    const existing = await deps.accountsPayableStore.findVendorByExternalRef(
      parsed.data.tenantId,
      externalSource,
      externalId
    );
    if (existing) {
      return err(409, "accounts-payable.EXTERNAL_VENDOR_CONFLICT", "A vendor already uses this external reference.", deps);
    }
  }

  const now = isoNow(deps.now);
  const vendor: Vendor = {
    id: accountsPayableId("ven"),
    tenantId: parsed.data.tenantId,
    name: parsed.data.name.trim(),
    email: parsed.data.email ?? null,
    phone: normalizeOptional(parsed.data.phone),
    addressLine1: normalizeOptional(parsed.data.addressLine1),
    city: normalizeOptional(parsed.data.city),
    state: normalizeOptional(parsed.data.state),
    postalCode: normalizeOptional(parsed.data.postalCode),
    country: normalizeOptional(parsed.data.country),
    taxId: normalizeOptional(parsed.data.taxId),
    is1099Vendor: parsed.data.is1099Vendor,
    defaultExpenseAccountId: normalizeOptional(parsed.data.defaultExpenseAccountId),
    defaultPaymentTermsDays: parsed.data.defaultPaymentTermsDays,
    currency: normalizeCurrency(parsed.data.currency),
    externalId,
    externalSource,
    notes: parsed.data.notes ?? null,
    active: true,
    createdById: deps.actor?.id ?? null,
    createdAt: now,
    updatedAt: now
  };

  await deps.accountsPayableStore.insertVendor(vendor);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.vendor_created",
    entityType: "accounts-payable",
    entityId: vendor.id,
    tenantId: vendor.tenantId,
    payload: { name: vendor.name, externalSource: vendor.externalSource }
  };
  await deps.accountsPayableStore.writeEvent(event);
  await hooks(deps).afterVendorCreated(vendor);

  return ok(201, { vendor, event }, deps);
}
