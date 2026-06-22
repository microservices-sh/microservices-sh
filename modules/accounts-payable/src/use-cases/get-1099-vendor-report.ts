import { vendor1099ReportInputSchema } from "../schemas";
import type { Vendor1099Report, Vendor1099ReportVendor } from "../types";
import { err, ok, type AccountsPayableDeps } from "./shared";

function yearBounds(year: number) {
  return {
    startDate: new Date(Date.UTC(year, 0, 1)).toISOString(),
    endDate: new Date(Date.UTC(year + 1, 0, 1)).toISOString()
  };
}

export async function get1099VendorReport(input: unknown, deps: AccountsPayableDeps) {
  const parsed = vendor1099ReportInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_1099_REPORT_INPUT", "1099 report input is invalid.", deps, parsed.error.issues);
  }

  const { startDate, endDate } = yearBounds(parsed.data.year);
  const [vendors, payments] = await Promise.all([
    deps.accountsPayableStore.listVendors({
      tenantId: parsed.data.tenantId,
      active: true,
      includeInactive: false,
      limit: 500
    }),
    deps.accountsPayableStore.listPayments({
      tenantId: parsed.data.tenantId,
      status: "posted",
      paymentDateFrom: startDate,
      paymentDateBefore: endDate,
      limit: 5000
    })
  ]);

  const totalsByVendor = new Map<string, { totalPaidCents: number; paymentCount: number }>();
  for (const payment of payments) {
    const current = totalsByVendor.get(payment.vendorId) ?? { totalPaidCents: 0, paymentCount: 0 };
    current.totalPaidCents += payment.amountCents;
    current.paymentCount += 1;
    totalsByVendor.set(payment.vendorId, current);
  }

  const reportVendors: Vendor1099ReportVendor[] = vendors
    .filter((vendor) => vendor.is1099Vendor)
    .map((vendor) => {
      const paymentTotals = totalsByVendor.get(vendor.id) ?? { totalPaidCents: 0, paymentCount: 0 };
      const taxIdOnFile = Boolean(vendor.taxId);
      const warnings = taxIdOnFile ? [] : ["Missing vendor tax ID"];
      return {
        vendorId: vendor.id,
        name: vendor.name,
        email: vendor.email,
        currency: vendor.currency,
        taxIdOnFile,
        totalPaidCents: paymentTotals.totalPaidCents,
        paymentCount: paymentTotals.paymentCount,
        readyForReview: taxIdOnFile,
        warnings
      };
    });

  const report: Vendor1099Report = {
    tenantId: parsed.data.tenantId,
    year: parsed.data.year,
    startDate,
    endDate,
    vendors: reportVendors,
    totals: {
      vendorCount: reportVendors.length,
      readyCount: reportVendors.filter((vendor) => vendor.readyForReview).length,
      missingTaxIdCount: reportVendors.filter((vendor) => !vendor.taxIdOnFile).length,
      totalPaidCents: reportVendors.reduce((total, vendor) => total + vendor.totalPaidCents, 0)
    }
  };

  return ok(200, { report }, deps);
}
