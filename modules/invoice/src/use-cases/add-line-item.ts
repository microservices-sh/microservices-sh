import { lineItemInputSchema } from "../schemas";
import { computeTotals, lineAmountCents } from "../totals";
import type { InvoiceStore } from "../ports";
import type { InvoiceLineItem } from "../types";

// Add a line item to a DRAFT invoice and recompute totals. Issued invoices are
// immutable — edits are rejected, never silently applied. Corrections after issue
// go through void + reissue (or a credit note).
export async function addLineItem(
  invoiceId: string,
  input: unknown,
  deps: { invoiceStore: InvoiceStore; now?: () => number }
) {
  const parsed = lineItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_LINE_ITEM", message: "Line item is invalid.", issues: parsed.error.issues }
    };
  }

  const invoice = await deps.invoiceStore.get(invoiceId);
  if (!invoice) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "INVOICE_NOT_FOUND", message: "Invoice not found." } };
  }
  if (invoice.status !== "draft") {
    return {
      ok: false as const,
      status: 409 as const,
      data: null,
      error: { code: "INVOICE_NOT_EDITABLE", message: `Invoice is ${invoice.status}; only draft invoices can be edited.` }
    };
  }

  const item: InvoiceLineItem = {
    id: "ili_" + crypto.randomUUID().slice(0, 16),
    invoiceId,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unitAmountCents: parsed.data.unitAmountCents,
    taxRateBps: parsed.data.taxRateBps,
    amountCents: lineAmountCents(parsed.data.quantity, parsed.data.unitAmountCents)
  };
  await deps.invoiceStore.insertLineItem(item);

  const items = await deps.invoiceStore.listLineItems(invoiceId);
  const totals = computeTotals(items);
  invoice.subtotalCents = totals.subtotalCents;
  invoice.taxCents = totals.taxCents;
  invoice.totalCents = totals.totalCents;
  invoice.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.invoiceStore.update(invoice);

  return { ok: true as const, status: 200 as const, data: { id: item.id, totalCents: invoice.totalCents } };
}
