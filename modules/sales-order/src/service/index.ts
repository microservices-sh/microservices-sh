import type { CustomerSnapshot, SalesOrderLineItem, SalesOrderTotals } from "../types";

interface CustomerSnapshotInput {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  taxId?: string | null;
}

export function salesOrderId(prefix: string): string {
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

export function normalizeCustomerSnapshot(snapshot: CustomerSnapshotInput | null | undefined): CustomerSnapshot | null {
  if (!snapshot) return null;
  return {
    displayName: snapshot.displayName.trim(),
    email: snapshot.email ?? null,
    phone: snapshot.phone ?? null,
    billingAddress: snapshot.billingAddress ?? null,
    shippingAddress: snapshot.shippingAddress ?? null,
    taxId: snapshot.taxId ?? null
  };
}

export function calculateLineTotals(input: {
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxCents: number;
}): SalesOrderTotals {
  const subtotalCents = input.quantity * input.unitPriceCents;
  const totalCents = Math.max(0, subtotalCents - input.discountCents + input.taxCents);
  return {
    subtotalCents,
    discountCents: input.discountCents,
    taxCents: input.taxCents,
    totalCents
  };
}

export function calculateOrderTotals(lineItems: Pick<SalesOrderLineItem, "subtotalCents" | "discountCents" | "taxCents" | "totalCents">[]): SalesOrderTotals {
  return lineItems.reduce(
    (totals, line) => ({
      subtotalCents: totals.subtotalCents + line.subtotalCents,
      discountCents: totals.discountCents + line.discountCents,
      taxCents: totals.taxCents + line.taxCents,
      totalCents: totals.totalCents + line.totalCents
    }),
    { subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 }
  );
}
