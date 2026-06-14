import type { InvoiceStore } from "../ports";

// Void an invoice. Paid invoices cannot be voided (issue a credit note instead) —
// the accounting immutability rule agents skip. Voiding never deletes the record.
export async function voidInvoice(
  invoiceId: string,
  deps: { invoiceStore: InvoiceStore; now?: () => number }
) {
  const invoice = await deps.invoiceStore.get(invoiceId);
  if (!invoice) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "INVOICE_NOT_FOUND", message: "Invoice not found." } };
  }
  if (invoice.status === "paid") {
    return {
      ok: false as const,
      status: 409 as const,
      data: null,
      error: { code: "CANNOT_VOID_PAID", message: "Paid invoices cannot be voided; issue a credit note." }
    };
  }
  if (invoice.status === "void") {
    return { ok: true as const, status: 200 as const, data: { id: invoice.id, status: "void" as const } };
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  invoice.status = "void";
  invoice.voidedAt = nowIso;
  invoice.updatedAt = nowIso;
  await deps.invoiceStore.update(invoice);

  return { ok: true as const, status: 200 as const, data: { id: invoice.id, status: "void" as const } };
}
