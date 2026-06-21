import { describe, expect, it } from "vitest";

import { buildInvoiceEmail } from "../../templates/commerce-ops-sveltekit/src/lib/server/invoice-email.ts";
import { parseStripeInvoiceSettlementEvent } from "../../templates/commerce-ops-sveltekit/src/lib/server/stripe-invoice-settlement.ts";

describe("commerce invoice payment workflow helpers", () => {
  it("builds escaped invoice email content with payment link context", () => {
    const email = buildInvoiceEmail({
      invoiceNumber: "INV-42<script>",
      customerName: "Ava <Buyer>",
      totalCents: 12_500,
      outstandingCents: 7_500,
      currency: "USD",
      dueAt: "2026-06-21T00:00:00.000Z",
      paymentLinkUrl: "https://pay.example/inv_42?x=1&y=2",
      companyName: "StackSuite"
    });

    expect(email.subject).toBe("Invoice INV-42<script> from StackSuite");
    expect(email.html).toContain("Ava &lt;Buyer&gt;");
    expect(email.html).toContain("INV-42&lt;script&gt;");
    expect(email.html).toContain("$75.00");
    expect(email.html).toContain("https://pay.example/inv_42?x=1&amp;y=2");
    expect(email.text).toContain("Pay online: https://pay.example/inv_42?x=1&y=2");
    expect(email.html).not.toContain("Ava <Buyer>");
  });

  it("parses a Stripe checkout session into an invoice settlement payload", () => {
    const parsed = parseStripeInvoiceSettlementEvent(
      JSON.stringify({
        id: "evt_checkout_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_1",
            payment_intent: "pi_test_1",
            amount_total: 12_500,
            metadata: { invoiceId: "inv_1", invoiceNumber: "INV-1" }
          }
        }
      })
    );

    expect(parsed).toEqual({
      ok: true,
      ignored: false,
      eventId: "evt_checkout_1",
      type: "checkout.session.completed",
      invoiceId: "inv_1",
      amountCents: 12_500,
      providerPaymentId: "pi_test_1"
    });
  });

  it("parses payment_intent.succeeded events and ignores unrelated Stripe events", () => {
    const paymentIntent = parseStripeInvoiceSettlementEvent(
      JSON.stringify({
        id: "evt_pi_1",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_1", amount_received: 6_400, metadata: { invoiceId: "inv_2" } } }
      })
    );
    expect(paymentIntent).toMatchObject({ ok: true, ignored: false, invoiceId: "inv_2", amountCents: 6_400 });

    const ignored = parseStripeInvoiceSettlementEvent(JSON.stringify({ id: "evt_other", type: "customer.created" }));
    expect(ignored).toEqual({ ok: true, ignored: true, type: "customer.created" });
  });

  it("rejects malformed invoice settlement webhook bodies before mutation", () => {
    expect(parseStripeInvoiceSettlementEvent("{not json")).toMatchObject({ ok: false, status: 400, code: "INVALID_WEBHOOK_BODY" });
    expect(
      parseStripeInvoiceSettlementEvent(
        JSON.stringify({
          id: "evt_missing_invoice",
          type: "checkout.session.completed",
          data: { object: { amount_total: 1_000, metadata: {} } }
        })
      )
    ).toMatchObject({ ok: false, status: 400, code: "MISSING_INVOICE_ID" });
  });
});
