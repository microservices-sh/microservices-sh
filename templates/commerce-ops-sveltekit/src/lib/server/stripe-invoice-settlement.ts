const SUPPORTED_EVENTS = new Set(["checkout.session.completed", "payment_intent.succeeded"]);

export type StripeInvoiceSettlementParseResult =
  | {
      ok: true;
      ignored: false;
      eventId: string;
      type: string;
      invoiceId: string;
      amountCents: number;
      providerPaymentId: string | null;
    }
  | { ok: true; ignored: true; type: string }
  | { ok: false; status: number; code: string; message: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function positiveInteger(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseStripeInvoiceSettlementEvent(rawBody: string): StripeInvoiceSettlementParseResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(rawBody));
  } catch {
    return { ok: false, status: 400, code: "INVALID_WEBHOOK_BODY", message: "Webhook body is not valid JSON." };
  }

  const type = stringValue(parsed.type) ?? "";
  if (!SUPPORTED_EVENTS.has(type)) return { ok: true, ignored: true, type };

  const eventId = stringValue(parsed.id);
  if (!eventId) {
    return { ok: false, status: 400, code: "MISSING_EVENT_ID", message: "Stripe event is missing an id." };
  }

  const object = asRecord(asRecord(parsed.data).object);
  const metadata = asRecord(object.metadata);
  const invoiceId = stringValue(metadata.invoiceId);
  if (!invoiceId) {
    return { ok: false, status: 400, code: "MISSING_INVOICE_ID", message: "Stripe event metadata is missing invoiceId." };
  }

  const amountCents =
    positiveInteger(object.amount_received) ?? positiveInteger(object.amount_total) ?? positiveInteger(object.amount_paid);
  if (!amountCents) {
    return { ok: false, status: 400, code: "MISSING_AMOUNT", message: "Stripe event is missing a positive payment amount." };
  }

  return {
    ok: true,
    ignored: false,
    eventId,
    type,
    invoiceId,
    amountCents,
    providerPaymentId: stringValue(object.payment_intent) ?? stringValue(object.id)
  };
}
