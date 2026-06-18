import { describe, expect, it } from "vitest";
import {
  createMemoryPaymentGateway,
  createMemoryPaymentRepository,
  createPaymentIntent,
  handleWebhook,
  signWebhook,
} from "../../modules/payment/src/index";
import {
  applyStripeEvent,
  createMemoryBillingStore,
  createPlan,
  dueForDunning,
  listSubscriptions,
  recordUsage,
  startSubscription,
} from "../../modules/billing-subscriptions/src/index";
import {
  createInvoice,
  createMemoryInvoiceStore,
  createMemoryNumberAllocator,
  dueForReminder,
  issueInvoice,
  listInvoices,
  recordPayment,
} from "../../modules/invoice/src/index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const CID = "corr-saas-billing-e2e";
const WEBHOOK_SECRET = "whsec_test_e2e";

function fixedNow(ms: number): () => number {
  return () => ms;
}

function mustOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  if (result.ok) return result.data;
  throw new Error(`Expected ok result: ${JSON.stringify(result.error)}`);
}

function stripeWebhookPayload(type: string, object: Record<string, unknown>): string {
  return JSON.stringify({ id: `evt_${type.replace(/[^a-z0-9]+/gi, "_")}`, type, data: { object } });
}

describe("SaaS billing E2E: payment, subscription, and invoice modules", () => {
  it("activates a paid subscription, issues an invoice, and dedupes replayed events", async () => {
    const paymentRepository = createMemoryPaymentRepository();
    const paymentGateway = createMemoryPaymentGateway();
    const billingStore = createMemoryBillingStore();
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();

    const plan = mustOk(
      await createPlan(
        {
          name: "Pro",
          priceCents: 2_900,
          currency: "USD",
          interval: "month",
          stripePriceId: "price_pro_monthly",
          features: ["projects:10", "seats:3"],
        },
        { store: billingStore, now: fixedNow(T0), correlationId: CID }
      )
    );

    const checkout = mustOk(
      await createPaymentIntent(
        { customerId: "cus_e2e_1", amount: 2_900, currency: "usd", description: "Pro subscription" },
        { paymentRepository, paymentGateway, now: fixedNow(T0 + 1_000), correlationId: CID }
      )
    );
    expect(checkout.payment.status).toBe("pending");
    expect(checkout.event.name).toBe("payment.checkout_created");
    expect(checkout.event.correlationId).toBe(CID);

    const paymentSucceededBody = stripeWebhookPayload("payment_intent.succeeded", { id: checkout.payment.intentId });
    const paymentSucceededSignature = await signWebhook(paymentSucceededBody, WEBHOOK_SECRET, Math.floor(T0 / 1000));
    const paidPayment = mustOk(
      await handleWebhook(paymentSucceededBody, paymentSucceededSignature, {
        paymentRepository,
        webhookSecret: WEBHOOK_SECRET,
        now: fixedNow(T0 + 2_000),
      })
    );
    expect(paidPayment.payment.status).toBe("succeeded");
    expect(paidPayment.event.name).toBe("payment.succeeded");

    const subscription = mustOk(
      await startSubscription(
        {
          subscriberId: "org_e2e_1",
          planId: plan.id,
          trialDays: 0,
          stripeSubscriptionId: "sub_e2e_success",
        },
        { store: billingStore, now: fixedNow(T0 + 3_000), correlationId: CID }
      )
    );
    expect(subscription.status).toBe("active");
    expect(subscription.event.name).toBe("subscription.activated");

    const usage = mustOk(
      await recordUsage(
        { subscriptionId: subscription.id, meter: "ai_credits", quantity: 42, idempotencyKey: "usage_evt_1" },
        { store: billingStore, now: fixedNow(T0 + 4_000), correlationId: CID }
      )
    );
    expect(usage.deduped).toBe(false);
    const replayedUsage = mustOk(
      await recordUsage(
        { subscriptionId: subscription.id, meter: "ai_credits", quantity: 42, idempotencyKey: "usage_evt_1" },
        { store: billingStore, now: fixedNow(T0 + 5_000), correlationId: CID }
      )
    );
    expect(replayedUsage.deduped).toBe(true);

    const stripeInvoiceEvent = {
      id: "evt_invoice_payment_succeeded_1",
      type: "invoice.payment_succeeded",
      stripeSubscriptionId: "sub_e2e_success",
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-02-01T00:00:00.000Z",
    };
    const subscriptionSynced = mustOk(
      await applyStripeEvent(stripeInvoiceEvent, { store: billingStore, now: fixedNow(T0 + 6_000), correlationId: CID })
    );
    expect(subscriptionSynced.status).toBe("active");

    const replayedSubscriptionEvent = mustOk(
      await applyStripeEvent(stripeInvoiceEvent, { store: billingStore, now: fixedNow(T0 + 7_000), correlationId: CID })
    );
    expect(replayedSubscriptionEvent.deduped).toBe(true);

    const invoice = mustOk(
      await createInvoice(
        {
          tenantId: "org_e2e_1",
          customerId: "cus_e2e_1",
          currency: "USD",
          lineItems: [{ description: "Pro subscription - January 2026", quantity: 1, unitAmountCents: 2_900, taxRateBps: 0 }],
        },
        { invoiceStore, now: fixedNow(T0 + 8_000), correlationId: CID }
      )
    );
    expect(invoice.totalCents).toBe(2_900);

    const issued = mustOk(
      await issueInvoice(
        { invoiceId: invoice.id, termsDays: 0 },
        { invoiceStore, allocator, now: fixedNow(T0 + 9_000), correlationId: CID }
      )
    );
    expect(issued.number).toBe("INV-00001");
    expect(issued.status).toBe("open");

    const paidInvoice = mustOk(
      await recordPayment(
        { invoiceId: invoice.id, amountCents: 2_900, idempotencyKey: "evt_payment_intent_succeeded_1" },
        { invoiceStore, now: fixedNow(T0 + 10_000), correlationId: CID }
      )
    );
    expect(paidInvoice.status).toBe("paid");
    expect(paidInvoice.event?.name).toBe("invoice.paid");

    const replayedInvoicePayment = mustOk(
      await recordPayment(
        { invoiceId: invoice.id, amountCents: 2_900, idempotencyKey: "evt_payment_intent_succeeded_1" },
        { invoiceStore, now: fixedNow(T0 + 11_000), correlationId: CID }
      )
    );
    expect(replayedInvoicePayment.deduped).toBe(true);
    expect(replayedInvoicePayment.amountPaidCents).toBe(2_900);

    const subscriptions = mustOk(await listSubscriptions({ subscriberId: "org_e2e_1" }, { store: billingStore, correlationId: CID }));
    expect(subscriptions.count).toBe(1);
    expect(subscriptions.subscriptions[0]).toMatchObject({ id: subscription.id, status: "active" });

    const invoices = mustOk(
      await listInvoices({ tenantId: "org_e2e_1", customerId: "cus_e2e_1", status: "paid" }, { invoiceStore, correlationId: CID })
    );
    expect(invoices.count).toBe(1);
    expect(invoices.invoices[0]).toMatchObject({ id: invoice.id, amountPaidCents: 2_900, status: "paid" });
  });

  it("marks failed renewals past_due and surfaces subscription plus invoice dunning", async () => {
    const paymentRepository = createMemoryPaymentRepository();
    const paymentGateway = createMemoryPaymentGateway();
    const billingStore = createMemoryBillingStore();
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();

    const plan = mustOk(
      await createPlan(
        { name: "Business", priceCents: 9_900, currency: "USD", interval: "month", stripePriceId: "price_business_monthly" },
        { store: billingStore, now: fixedNow(T0), correlationId: CID }
      )
    );
    const subscription = mustOk(
      await startSubscription(
        { subscriberId: "org_e2e_2", planId: plan.id, trialDays: 0, stripeSubscriptionId: "sub_e2e_failed" },
        { store: billingStore, now: fixedNow(T0 + 1_000), correlationId: CID }
      )
    );

    const renewalPayment = mustOk(
      await createPaymentIntent(
        { customerId: "cus_e2e_2", amount: 9_900, currency: "usd", description: "Business renewal" },
        { paymentRepository, paymentGateway, now: fixedNow(T0 + 2_000), correlationId: CID }
      )
    );
    const paymentFailedBody = stripeWebhookPayload("payment_intent.payment_failed", { id: renewalPayment.payment.intentId });
    const paymentFailedSignature = await signWebhook(paymentFailedBody, WEBHOOK_SECRET, Math.floor(T0 / 1000));
    const failedPayment = mustOk(
      await handleWebhook(paymentFailedBody, paymentFailedSignature, {
        paymentRepository,
        webhookSecret: WEBHOOK_SECRET,
        now: fixedNow(T0 + 3_000),
      })
    );
    expect(failedPayment.payment.status).toBe("failed");
    expect(failedPayment.event.name).toBe("payment.failed");

    const pastDue = mustOk(
      await applyStripeEvent(
        { id: "evt_invoice_payment_failed_1", type: "invoice.payment_failed", stripeSubscriptionId: "sub_e2e_failed" },
        { store: billingStore, now: fixedNow(T0 + 4_000), correlationId: CID }
      )
    );
    expect(pastDue.status).toBe("past_due");
    expect(pastDue.previous).toBe("active");
    expect(pastDue.event?.name).toBe("subscription.past_due");

    const renewalInvoice = mustOk(
      await createInvoice(
        {
          tenantId: "org_e2e_2",
          customerId: "cus_e2e_2",
          currency: "USD",
          lineItems: [{ description: "Business renewal - January 2026", quantity: 1, unitAmountCents: 9_900, taxRateBps: 0 }],
        },
        { invoiceStore, now: fixedNow(T0 + 5_000), correlationId: CID }
      )
    );
    const issued = mustOk(
      await issueInvoice(
        { invoiceId: renewalInvoice.id, termsDays: 0 },
        { invoiceStore, allocator, now: fixedNow(T0 + 6_000), correlationId: CID }
      )
    );
    expect(issued.status).toBe("open");

    const dunning = mustOk(await dueForDunning({ store: billingStore, correlationId: CID }));
    expect(dunning.count).toBe(1);
    expect(dunning.subscriptions[0]).toMatchObject({ id: subscription.id, status: "past_due" });

    const reminders = mustOk(await dueForReminder({ invoiceStore, now: fixedNow(T0 + 7_000), correlationId: CID }));
    expect(reminders.count).toBe(1);
    expect(reminders.invoices[0]).toMatchObject({ id: renewalInvoice.id, status: "open", totalCents: 9_900 });
  });
});
