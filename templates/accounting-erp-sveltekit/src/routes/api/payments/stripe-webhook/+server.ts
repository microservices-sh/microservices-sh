import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { authContext, getInvoiceScoped, recordPaymentScoped } from "@microservices-sh/invoice";
import { createAccountsReceivableService } from "@microservices-sh/accounts-receivable";
import { recordEvent } from "@microservices-sh/audit-log";
import { verifyWebhookSignature } from "@microservices-sh/payment";
import { parseStripeInvoiceSettlementEvent } from "$lib/server/stripe-invoice-settlement";
import { syncInvoiceToReceivables } from "$lib/server/accounts-receivable-sync";
import { createAccountsReceivableAccountingPoster } from "$lib/server/accounts-receivable-accounting";

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  const secret = platform?.env?.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return json({ ok: false, error: { code: "STRIPE_WEBHOOK_NOT_CONFIGURED", message: "Stripe webhook secret is not configured." } }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const verified = await verifyWebhookSignature(rawBody, signature, secret);
  if (!verified) {
    return json({ ok: false, error: { code: "INVALID_SIGNATURE", message: "Webhook signature is invalid." } }, { status: 401 });
  }

  const parsed = parseStripeInvoiceSettlementEvent(rawBody);
  if (!parsed.ok) {
    return json({ ok: false, error: { code: parsed.code, message: parsed.message } }, { status: parsed.status });
  }
  if (parsed.ignored) {
    return json({ ok: true, ignored: true, type: parsed.type });
  }

  const invoice = await locals.invoiceStore.get(parsed.invoiceId);
  if (!invoice) {
    return json({ ok: false, error: { code: "INVOICE_NOT_FOUND", message: "Invoice not found." } }, { status: 404 });
  }

  const ctx = authContext({ orgId: invoice.tenantId, actorId: "stripe:webhook", roles: ["*"] });
  const paymentDate = new Date().toISOString();
  const arService = createAccountsReceivableService({
    store: locals.accountsReceivableStore,
    accountingPoster: createAccountsReceivableAccountingPoster({
      accountingCoreStore: locals.accountingCoreStore,
      actor: { id: "stripe:webhook", permissions: ["*"] }
    })
  });
  const customerPayment = await arService.recordCustomerPayment(
    { tenantId: invoice.tenantId, actorId: "stripe:webhook", now: paymentDate },
    {
      customerId: invoice.customerId,
      amountCents: parsed.amountCents,
      currency: invoice.currency,
      paymentMethod: "stripe",
      providerPaymentId: parsed.providerPaymentId,
      paymentDate,
      idempotencyKey: parsed.eventId
    }
  );
  if (!customerPayment.ok || !customerPayment.data) {
    return json(
      { ok: false, error: { code: customerPayment.error?.code ?? "AR_PAYMENT_FAILED", message: customerPayment.error?.message ?? "Could not record customer payment." } },
      { status: 400 }
    );
  }

  const application = customerPayment.data.unappliedCents > 0
    ? await arService.applyCustomerPayment(
        { tenantId: invoice.tenantId, actorId: "stripe:webhook", now: paymentDate },
        {
          paymentId: customerPayment.data.id,
          applications: [{ invoiceId: invoice.id, amountCents: parsed.amountCents }]
        }
      )
    : null;
  if (application && (!application.ok || !application.data)) {
    return json(
      { ok: false, error: { code: application.error?.code ?? "AR_APPLICATION_FAILED", message: application.error?.message ?? "Could not apply customer payment." } },
      { status: 400 }
    );
  }

  const result = await recordPaymentScoped(
    ctx,
    { invoiceId: invoice.id, amountCents: parsed.amountCents, idempotencyKey: parsed.eventId },
    { invoiceStore: locals.invoiceStore }
  );
  if (!result.ok || !result.data) {
    return json(
      { ok: false, error: { code: result.error?.code ?? "INVOICE_PAYMENT_FAILED", message: result.error?.message ?? "Could not record invoice payment." } },
      { status: result.status ?? 400 }
    );
  }

  const invoiceSnapshot = await getInvoiceScoped(ctx, invoice.id, { invoiceStore: locals.invoiceStore });
  const receivablesSync = invoiceSnapshot.ok && invoiceSnapshot.data
    ? await syncInvoiceToReceivables({
        accountsReceivableService: arService,
        tenantId: invoice.tenantId,
        actorId: "stripe:webhook",
        invoice: invoiceSnapshot.data.invoice
      })
    : { ok: false as const, message: "Could not load the settled invoice for receivables sync." };

  await recordEvent(
    {
      eventName: result.data.status === "paid" ? "invoice.paid" : "invoice.payment_recorded",
      actorId: "stripe:webhook",
      entityType: "invoice",
      entityId: invoice.id,
      source: "api/payments/stripe-webhook",
      payload: {
        stripeEventId: parsed.eventId,
        stripeEventType: parsed.type,
        providerPaymentId: parsed.providerPaymentId,
        amountCents: parsed.amountCents,
        status: result.data.status,
        deduped: result.data.deduped,
        customerPaymentId: customerPayment.data.id,
        paymentApplicationIds: application?.ok ? application.data.applications.map((item) => item.id) : [],
        journalEntryId: application?.ok ? application.data.payment.journalEntryId : customerPayment.data.journalEntryId,
        receivablesSynced: receivablesSync.ok,
        receivablesSyncError: receivablesSync.ok ? null : receivablesSync.message
      }
    },
    { auditStore: locals.auditStore }
  );

  return json({
    ok: true,
    invoiceId: invoice.id,
    status: result.data.status,
    deduped: result.data.deduped,
    receivablesSynced: receivablesSync.ok
  });
};
