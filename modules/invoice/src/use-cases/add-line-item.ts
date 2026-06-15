import { ok, err } from "@microservices-sh/connection-contract";
import { lineItemInputSchema } from "../schemas";
import { invoiceMeta } from "../meta";
import { computeTotals, lineAmountCents } from "../totals";
import type { InvoiceStore } from "../ports";
import type { InvoiceLineItem } from "../types";

// Add a line item to a DRAFT invoice and recompute totals. Issued invoices are
// immutable — edits are rejected, never silently applied. Corrections after issue
// go through void + reissue (or a credit note).
export async function addLineItem(
  invoiceId: string,
  input: unknown,
  deps: { invoiceStore: InvoiceStore; now?: () => number; correlationId?: string }
) {
  const meta = invoiceMeta(deps);

  const parsed = lineItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "invoice.INVALID_LINE_ITEM", message: "Line item is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const invoice = await deps.invoiceStore.get(invoiceId);
  if (!invoice) {
    return err(404, { code: "invoice.INVOICE_NOT_FOUND", message: "Invoice not found." }, meta);
  }
  if (invoice.status !== "draft") {
    return err(
      409,
      { code: "invoice.INVOICE_NOT_EDITABLE", message: `Invoice is ${invoice.status}; only draft invoices can be edited.` },
      meta
    );
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

  return ok(200, { id: item.id, totalCents: invoice.totalCents }, meta);
}
