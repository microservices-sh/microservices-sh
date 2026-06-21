import type {
  AgingBill,
  AgingReport,
  BillLineItem,
  BillTotals,
  BillWithLineItems,
  RecurringBillFrequency
} from "../types";

export function accountsPayableId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function isoNow(now?: () => number): string {
  return new Date(now ? now() : Date.now()).toISOString();
}

export function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function lineSubtotalCents(quantity: number, unitAmountCents: number): number {
  return quantity * unitAmountCents;
}

export function calculateLineTotals(input: {
  quantity: number;
  unitAmountCents: number;
  taxCents: number;
}): BillTotals {
  const subtotalCents = lineSubtotalCents(input.quantity, input.unitAmountCents);
  return { subtotalCents, taxCents: input.taxCents, totalCents: subtotalCents + input.taxCents };
}

export function calculateBillTotals(lines: Pick<BillLineItem, "subtotalCents" | "taxCents" | "totalCents">[]): BillTotals {
  return lines.reduce(
    (totals, line) => ({
      subtotalCents: totals.subtotalCents + line.subtotalCents,
      taxCents: totals.taxCents + line.taxCents,
      totalCents: totals.totalCents + line.totalCents
    }),
    { subtotalCents: 0, taxCents: 0, totalCents: 0 }
  );
}

export function assertSuppliedTotalsMatch(
  supplied: Partial<BillTotals>,
  computed: BillTotals
): { ok: true } | { ok: false; field: keyof BillTotals; expected: number; actual: number } {
  for (const field of ["subtotalCents", "taxCents", "totalCents"] as const) {
    if (supplied[field] !== undefined && supplied[field] !== computed[field]) {
      return { ok: false, field, expected: computed[field], actual: supplied[field] };
    }
  }
  return { ok: true };
}

export function nextRecurringBillDate(
  startDateIso: string,
  frequency: RecurringBillFrequency,
  customDays?: number | null,
  lastBillDateIso?: string | null
): string {
  const next = new Date(lastBillDateIso ?? startDateIso);
  if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  if (frequency === "quarterly") next.setUTCMonth(next.getUTCMonth() + 3);
  if (frequency === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  if (frequency === "custom") next.setUTCDate(next.getUTCDate() + (customDays ?? 1));
  return next.toISOString();
}

function emptyVendor(vendorId: string) {
  return {
    vendorId,
    currentCents: 0,
    days1To30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    days90PlusCents: 0,
    totalCents: 0,
    bills: [] as AgingBill[]
  };
}

export function buildAgingReport(input: {
  tenantId: string;
  asOfDate: string;
  bills: BillWithLineItems[];
}): AgingReport {
  const reportMs = Date.parse(input.asOfDate);
  const vendors = new Map<string, ReturnType<typeof emptyVendor>>();
  const totals = {
    currentCents: 0,
    days1To30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    days90PlusCents: 0,
    totalCents: 0
  };

  for (const bill of input.bills) {
    const daysOverdue = Math.max(0, Math.floor((reportMs - Date.parse(bill.dueDate)) / 86_400_000));
    const agingBucket =
      daysOverdue <= 0
        ? "current"
        : daysOverdue <= 30
          ? "1-30"
          : daysOverdue <= 60
            ? "31-60"
            : daysOverdue <= 90
              ? "61-90"
              : "90+";

    const vendor = vendors.get(bill.vendorId) ?? emptyVendor(bill.vendorId);
    vendors.set(bill.vendorId, vendor);

    if (agingBucket === "current") {
      vendor.currentCents += bill.amountDueCents;
      totals.currentCents += bill.amountDueCents;
    } else if (agingBucket === "1-30") {
      vendor.days1To30Cents += bill.amountDueCents;
      totals.days1To30Cents += bill.amountDueCents;
    } else if (agingBucket === "31-60") {
      vendor.days31To60Cents += bill.amountDueCents;
      totals.days31To60Cents += bill.amountDueCents;
    } else if (agingBucket === "61-90") {
      vendor.days61To90Cents += bill.amountDueCents;
      totals.days61To90Cents += bill.amountDueCents;
    } else {
      vendor.days90PlusCents += bill.amountDueCents;
      totals.days90PlusCents += bill.amountDueCents;
    }

    vendor.totalCents += bill.amountDueCents;
    totals.totalCents += bill.amountDueCents;
    vendor.bills.push({
      id: bill.id,
      billNumber: bill.billNumber,
      vendorId: bill.vendorId,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      totalCents: bill.totalCents,
      amountDueCents: bill.amountDueCents,
      daysOverdue,
      agingBucket
    });
  }

  return { tenantId: input.tenantId, asOfDate: input.asOfDate, vendors: [...vendors.values()], totals };
}
