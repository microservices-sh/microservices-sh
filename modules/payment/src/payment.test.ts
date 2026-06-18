import { describe, expect, it } from "vitest";
import {
  createMemoryPaymentGateway,
  createMemoryPaymentRepository,
  createPaymentIntent,
  handleWebhook,
  signWebhook,
  verifyWebhookSignature
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const SECRET = "whsec_payment_test";

function fixedNow(ms: number): () => number {
  return () => ms;
}

function mustOk<T = unknown>(result: { ok: true; data: T } | { ok: false; error: unknown } | any): T {
  if (result.ok) return result.data;
  throw new Error(`Expected ok result: ${JSON.stringify(result.error)}`);
}

function paymentEvent(id: string, type: string, intentId: string): string {
  return JSON.stringify({ id, type, data: { object: { id: intentId } } });
}

type AppliedWebhook = { payment: { status: string; updatedAt: string }; event: { name: string } };
type DedupedWebhook = { payment: { status: string; updatedAt: string }; deduped: true; eventId: string };

describe("payment webhooks", () => {
  it("dedupes replayed provider event ids without updating payment twice", async () => {
    const paymentRepository = createMemoryPaymentRepository();
    const paymentGateway = createMemoryPaymentGateway();
    const checkout = mustOk<any>(
      await createPaymentIntent(
        { customerId: "cus_payment_1", amount: 1_000, currency: "usd" },
        { paymentRepository, paymentGateway, now: fixedNow(T0) }
      )
    );

    const body = paymentEvent("evt_payment_succeeded_1", "payment_intent.succeeded", checkout.payment.intentId);
    const signature = await signWebhook(body, SECRET, Math.floor(T0 / 1000));
    const first = mustOk<AppliedWebhook>(
      await handleWebhook(body, signature, {
        paymentRepository,
        webhookSecret: SECRET,
        now: fixedNow(T0 + 1_000)
      })
    );
    expect(first.payment.status).toBe("succeeded");
    expect(first.event.name).toBe("payment.succeeded");

    const replay = mustOk<DedupedWebhook>(
      await handleWebhook(body, signature, {
        paymentRepository,
        webhookSecret: SECRET,
        now: fixedNow(T0 + 2_000)
      })
    );
    expect(replay).toMatchObject({
      deduped: true,
      eventId: "evt_payment_succeeded_1",
      payment: { status: "succeeded", updatedAt: first.payment.updatedAt }
    });
  });

  it("rejects stale Stripe signatures by default", async () => {
    const body = paymentEvent("evt_stale", "payment_intent.succeeded", "pi_stale");
    const staleSignature = await signWebhook(body, SECRET, Math.floor((T0 - 301_000) / 1000));

    await expect(verifyWebhookSignature(body, staleSignature, SECRET, { now: fixedNow(T0) })).resolves.toBe(false);
    const result = await handleWebhook(body, staleSignature, {
      paymentRepository: createMemoryPaymentRepository(),
      webhookSecret: SECRET,
      now: fixedNow(T0)
    });
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("requires known payment webhook events to carry a provider event id", async () => {
    const body = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_missing_event_id" } } });
    const signature = await signWebhook(body, SECRET, Math.floor(T0 / 1000));
    const result = await handleWebhook(body, signature, {
      paymentRepository: createMemoryPaymentRepository(),
      webhookSecret: SECRET,
      now: fixedNow(T0)
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: { code: "MISSING_EVENT_ID" }
    });
  });
});
