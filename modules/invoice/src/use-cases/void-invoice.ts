import { ok, err } from "@microservices-sh/connection-contract";
import { invoiceMeta } from "../meta";
import type { InvoiceStore } from "../ports";
import type { DomainEvent } from "../types";

// Void an invoice. Paid invoices cannot be voided (issue a credit note instead) —
// the accounting immutability rule agents skip. Voiding never deletes the record.
// Emits invoice.voided.
export async function voidInvoice(
  invoiceId: string,
  deps: { invoiceStore: InvoiceStore; now?: () => number; correlationId?: string }
) {
  const meta = invoiceMeta(deps);

  const invoice = await deps.invoiceStore.get(invoiceId);
  if (!invoice) {
    return err(404, { code: "invoice.INVOICE_NOT_FOUND", message: "Invoice not found." }, meta);
  }
  if (invoice.status === "paid") {
    return err(
      409,
      { code: "invoice.CANNOT_VOID_PAID", message: "Paid invoices cannot be voided; issue a credit note." },
      meta
    );
  }
  if (invoice.status === "void") {
    return ok(200, { id: invoice.id, status: "void" as const }, meta);
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  invoice.status = "void";
  invoice.voidedAt = nowIso;
  invoice.updatedAt = nowIso;
  await deps.invoiceStore.update(invoice);

  const event: DomainEvent = {
    name: "invoice.voided",
    correlationId: meta.correlationId,
    payload: { id: invoice.id, customerId: invoice.customerId }
  };

  return ok(200, { id: invoice.id, status: "void" as const, event }, meta);
}
