import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { authContext, recordPaymentScoped } from "@microservices-sh/invoice";
import { recordEvent } from "@microservices-sh/audit-log";
import { verifyWebhookSignature } from "@microservices-sh/payment";
import { parseStripeInvoiceSettlementEvent } from "$lib/server/stripe-invoice-settlement";

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
        deduped: result.data.deduped
      }
    },
    { auditStore: locals.auditStore }
  );

  return json({ ok: true, invoiceId: invoice.id, status: result.data.status, deduped: result.data.deduped });
};
