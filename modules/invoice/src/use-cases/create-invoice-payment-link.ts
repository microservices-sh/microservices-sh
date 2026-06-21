import { ok, err } from "@microservices-sh/connection-contract";
import { createInvoicePaymentLinkInputSchema } from "../schemas";
import { invoiceMeta } from "../meta";
import type { InvoicePaymentLinkProvider, InvoiceStore } from "../ports";
import type { DomainEvent } from "../types";

function amountDueCents(totalCents: number, amountPaidCents: number): number {
  return Math.max(0, totalCents - amountPaidCents);
}

export async function createInvoicePaymentLink(
  input: unknown,
  deps: {
    invoiceStore: InvoiceStore;
    paymentLinkProvider: InvoicePaymentLinkProvider;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = invoiceMeta(deps);
  const parsed = createInvoicePaymentLinkInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "invoice.INVALID_PAYMENT_LINK_INPUT",
        message: "Payment link input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const invoice = await deps.invoiceStore.get(parsed.data.invoiceId);
  if (!invoice) {
    return err(404, { code: "invoice.INVOICE_NOT_FOUND", message: "Invoice not found." }, meta);
  }
  if (invoice.status === "draft" || !invoice.number) {
    return err(409, { code: "invoice.INVOICE_NOT_ISSUED", message: "Issue the invoice before creating a payment link." }, meta);
  }
  if (invoice.status === "void") {
    return err(409, { code: "invoice.INVOICE_VOID", message: "A void invoice cannot receive payment links." }, meta);
  }
  const dueCents = amountDueCents(invoice.totalCents, invoice.amountPaidCents);
  if (invoice.status === "paid" || dueCents <= 0) {
    return err(409, { code: "invoice.INVOICE_PAID", message: "A paid invoice does not need a payment link." }, meta);
  }

  if (invoice.paymentLinkId && invoice.paymentLinkUrl) {
    return ok(
      200,
      {
        id: invoice.id,
        paymentLinkId: invoice.paymentLinkId,
        paymentLinkUrl: invoice.paymentLinkUrl,
        provider: invoice.paymentLinkProvider,
        idempotent: true
      },
      meta
    );
  }

  const link = await deps.paymentLinkProvider.createPaymentLink({
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    amountCents: dueCents,
    currency: invoice.currency,
    customerId: invoice.customerId,
    customerEmail: parsed.data.customerEmail,
    description: `Payment for invoice ${invoice.number}`,
    successUrl: parsed.data.successUrl,
    idempotencyKey: `invoice:${invoice.id}:payment-link`
  });

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  invoice.paymentLinkId = link.id;
  invoice.paymentLinkUrl = link.url;
  invoice.paymentLinkProvider = link.provider;
  invoice.paymentLinkCreatedAt = nowIso;
  invoice.updatedAt = nowIso;
  await deps.invoiceStore.update(invoice);

  const event: DomainEvent = {
    name: "invoice.payment_link_created",
    correlationId: meta.correlationId,
    payload: {
      id: invoice.id,
      number: invoice.number,
      customerId: invoice.customerId,
      amountCents: dueCents,
      provider: link.provider
    }
  };

  return ok(
    201,
    {
      id: invoice.id,
      paymentLinkId: link.id,
      paymentLinkUrl: link.url,
      provider: link.provider,
      idempotent: false,
      event
    },
    meta
  );
}
