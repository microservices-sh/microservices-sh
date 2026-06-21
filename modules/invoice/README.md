# Invoice Module

Status: `available` (v0.1.0) · Class: `core` · Risk: `high`

Invoices for Cloudflare Workers + D1. Completes the booking/order → payment →
invoice loop and powers client-portal billing. It encapsulates the money bugs AI
agents reliably ship:

1. **Gapless atomic numbering** — numbers are allocated via an upsert that
   increments and `RETURNING`s the counter in one statement. `MAX(number)+1` in
   app code double-assigns under concurrency; this cannot.
2. **Enforced lifecycle** — `draft → open → paid → void`. Editing is allowed only
   while draft; issued invoices are immutable (corrections via void/reissue).
3. **Idempotent payments** — `recordPayment` dedups on an idempotency key, so a
   redelivered payment webhook is applied exactly once (no double-credit).
4. **Provider-backed payment links** — `createInvoicePaymentLink` stores one
   reusable link per issued, unpaid invoice and keeps Stripe behind a port.
5. **Per-line tax in integer cents** — tax rounds per line so a printed invoice
   reconciles line-by-line.

## Flow

```ts
import {
  createInvoice, addLineItem, issueInvoice, createInvoicePaymentLink, recordPayment, voidInvoice, dueForReminder,
  createD1InvoiceStore, createD1NumberAllocator, createStripeInvoicePaymentLinkProvider
} from "@microservices-sh/invoice";

const invoiceStore = createD1InvoiceStore(env.DB);
const allocator = createD1NumberAllocator(env.DB);
const paymentLinkProvider = createStripeInvoicePaymentLinkProvider(env.STRIPE_SECRET_KEY);

const draft = await createInvoice(
  { tenantId, customerId, lineItems: [{ description: "Consulting", quantity: 3, unitAmountCents: 15000, taxRateBps: 875 }] },
  { invoiceStore }
);
await issueInvoice({ invoiceId: draft.data.id, termsDays: 14 }, { invoiceStore, allocator }); // -> INV-00001
await createInvoicePaymentLink({ invoiceId: draft.data.id }, { invoiceStore, paymentLinkProvider });
await recordPayment({ invoiceId: draft.data.id, amountCents: 48938, idempotencyKey: stripeEventId }, { invoiceStore });
```

## Dunning

Run `dueForReminder({ invoiceStore })` on a **jobs-workflows** schedule and enqueue
a reminder job per overdue invoice (key the job on invoice id + date to send once).

## Resources

- D1 (`DB`): `invoices`, `invoice_line_items`, `invoice_sequences`, `invoice_payments` (migration `0001`).
- Optional Stripe payment-link adapter: `createStripeInvoicePaymentLinkProvider`.

## Verification

```bash
pnpm --filter @microservices-sh/invoice build
pnpm --filter @microservices-sh/invoice check:spec
```
