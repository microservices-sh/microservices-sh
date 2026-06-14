import type { InvoiceLineItem, InvoiceTotals } from "./types";

// Pure money math in integer cents. Tax is rounded per line (not on the grand
// total) so a printed invoice always reconciles line-by-line — the rounding
// convention agents get inconsistent. quantity is integer; rates are basis points.
export function lineAmountCents(quantity: number, unitAmountCents: number): number {
  return Math.round(quantity * unitAmountCents);
}

export function lineTaxCents(amountCents: number, taxRateBps: number): number {
  return Math.round((amountCents * taxRateBps) / 10_000);
}

export function computeTotals(
  items: Array<Pick<InvoiceLineItem, "quantity" | "unitAmountCents" | "taxRateBps">>
): InvoiceTotals {
  let subtotalCents = 0;
  let taxCents = 0;
  for (const item of items) {
    const amount = lineAmountCents(item.quantity, item.unitAmountCents);
    subtotalCents += amount;
    taxCents += lineTaxCents(amount, item.taxRateBps);
  }
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
