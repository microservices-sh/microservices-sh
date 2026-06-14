import { onInvoicePaid } from "../hooks";
import { recordPaymentInputSchema } from "../schemas";
import type { InvoiceStore } from "../ports";

// Apply a payment to an issued invoice. Idempotent when an idempotencyKey is
// supplied (e.g. a Stripe event id), so a redelivered payment webhook is applied
// exactly once — the guard agents omit, which double-credits invoices.
export async function recordPayment(
  input: unknown,
  deps: { invoiceStore: InvoiceStore; now?: () => number }
) {
  const parsed = recordPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_PAYMENT_INPUT", message: "Payment input is invalid.", issues: parsed.error.issues }
    };
  }

  const invoice = await deps.invoiceStore.get(parsed.data.invoiceId);
  if (!invoice) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "INVOICE_NOT_FOUND", message: "Invoice not found." } };
  }
  if (invoice.status === "draft") {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "INVOICE_NOT_ISSUED", message: "Issue the invoice before recording a payment." } };
  }
  if (invoice.status === "void") {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "INVOICE_VOID", message: "A void invoice cannot receive payments." } };
  }

  if (parsed.data.idempotencyKey) {
    const fresh = await deps.invoiceStore.recordPaymentKey(invoice.id, parsed.data.idempotencyKey);
    if (!fresh) {
      return {
        ok: true as const,
        status: 200 as const,
        data: { id: invoice.id, status: invoice.status, amountPaidCents: invoice.amountPaidCents, deduped: true }
      };
    }
  }

  invoice.amountPaidCents += parsed.data.amountCents;
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  let justPaid = false;
  if (invoice.status !== "paid" && invoice.amountPaidCents >= invoice.totalCents) {
    invoice.status = "paid";
    invoice.paidAt = nowIso;
    justPaid = true;
  }
  invoice.updatedAt = nowIso;
  await deps.invoiceStore.update(invoice);

  if (justPaid) await onInvoicePaid(invoice);

  return {
    ok: true as const,
    status: 200 as const,
    data: { id: invoice.id, status: invoice.status, amountPaidCents: invoice.amountPaidCents, deduped: false }
  };
}
