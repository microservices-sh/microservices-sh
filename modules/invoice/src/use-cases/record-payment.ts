import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { onInvoicePaid } from "../hooks";
import { recordPaymentInputSchema } from "../schemas";
import { invoiceMeta } from "../meta";
import type { InvoiceStore } from "../ports";
import type { DomainEvent, Invoice } from "../types";

// Apply a payment to an issued invoice. Idempotent when an idempotencyKey is
// supplied (e.g. a Stripe event id), so a redelivered payment webhook is applied
// exactly once — the guard agents omit, which double-credits invoices.
// Emits invoice.paid once the balance is fully covered.
export async function recordPayment(
  input: unknown,
  deps: {
    invoiceStore: InvoiceStore;
    now?: () => number;
    correlationId?: string;
    onPaidHooks?: ResolvedHook<Invoice>[];
  }
) {
  const meta = invoiceMeta(deps);

  const parsed = recordPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "invoice.INVALID_PAYMENT_INPUT", message: "Payment input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const invoice = await deps.invoiceStore.get(parsed.data.invoiceId);
  if (!invoice) {
    return err(404, { code: "invoice.INVOICE_NOT_FOUND", message: "Invoice not found." }, meta);
  }
  if (invoice.status === "draft") {
    return err(409, { code: "invoice.INVOICE_NOT_ISSUED", message: "Issue the invoice before recording a payment." }, meta);
  }
  if (invoice.status === "void") {
    return err(409, { code: "invoice.INVOICE_VOID", message: "A void invoice cannot receive payments." }, meta);
  }

  if (parsed.data.idempotencyKey) {
    const fresh = await deps.invoiceStore.recordPaymentKey(invoice.id, parsed.data.idempotencyKey);
    if (!fresh) {
      return ok(
        200,
        { id: invoice.id, status: invoice.status, amountPaidCents: invoice.amountPaidCents, deduped: true },
        meta
      );
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

  let event: DomainEvent | undefined;
  if (justPaid) {
    await onInvoicePaid(invoice);
    await runHooks("onInvoicePaid", invoice, { correlationId: meta.correlationId }, deps.onPaidHooks ?? []);
    event = {
      name: "invoice.paid",
      correlationId: meta.correlationId,
      payload: { id: invoice.id, customerId: invoice.customerId, amountPaidCents: invoice.amountPaidCents }
    };
  }

  return ok(
    200,
    { id: invoice.id, status: invoice.status, amountPaidCents: invoice.amountPaidCents, deduped: false, event },
    meta
  );
}
