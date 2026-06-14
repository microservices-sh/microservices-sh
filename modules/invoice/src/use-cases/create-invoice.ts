import { defaultConfig } from "../config";
import { createInvoiceInputSchema } from "../schemas";
import { computeTotals, lineAmountCents } from "../totals";
import type { InvoiceStore } from "../ports";
import type { Invoice, InvoiceLineItem } from "../types";

// Create a draft invoice with its line items. No number is assigned yet — numbers
// are allocated atomically at issue time so drafts that are deleted never burn a
// number (gapless sequence).
export async function createInvoice(
  input: unknown,
  deps: { invoiceStore: InvoiceStore; now?: () => number; config?: Partial<typeof defaultConfig> }
) {
  const parsed = createInvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_INVOICE_INPUT", message: "Invoice input is invalid.", issues: parsed.error.issues }
    };
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const id = "inv_" + crypto.randomUUID().slice(0, 16);

  const lineItems: InvoiceLineItem[] = parsed.data.lineItems.map((li) => ({
    id: "ili_" + crypto.randomUUID().slice(0, 16),
    invoiceId: id,
    description: li.description,
    quantity: li.quantity,
    unitAmountCents: li.unitAmountCents,
    taxRateBps: li.taxRateBps,
    amountCents: lineAmountCents(li.quantity, li.unitAmountCents)
  }));

  const totals = computeTotals(lineItems);
  const invoice: Invoice = {
    id,
    number: null,
    series: parsed.data.series,
    tenantId: parsed.data.tenantId,
    customerId: parsed.data.customerId,
    status: "draft",
    currency: parsed.data.currency,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    amountPaidCents: 0,
    notes: parsed.data.notes ?? null,
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    voidedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await deps.invoiceStore.insert(invoice);
  for (const item of lineItems) {
    await deps.invoiceStore.insertLineItem(item);
  }

  return { ok: true as const, status: 201 as const, data: { id, status: invoice.status, totalCents: invoice.totalCents } };
}
