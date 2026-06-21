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
5. **Recurring invoice templates** — `createRecurringInvoiceTemplate` and
   `generateDueRecurringInvoices` port StackSuite-style recurring billing with a
   unique occurrence key so retries do not double-bill.
6. **Per-line tax in integer cents** — tax rounds per line so a printed invoice
   reconciles line-by-line.

## Flow

```ts
import {
  createInvoice, addLineItem, issueInvoice, createInvoicePaymentLink, recordPayment, voidInvoice, dueForReminder,
  createRecurringInvoiceTemplate, generateDueRecurringInvoices,
  createD1InvoiceStore, createD1RecurringInvoiceStore, createD1NumberAllocator, createStripeInvoicePaymentLinkProvider
} from "@microservices-sh/invoice";

const invoiceStore = createD1InvoiceStore(env.DB);
const recurringInvoiceStore = createD1RecurringInvoiceStore(env.DB);
const allocator = createD1NumberAllocator(env.DB);
const paymentLinkProvider = createStripeInvoicePaymentLinkProvider(env.STRIPE_SECRET_KEY);

const draft = await createInvoice(
  { tenantId, customerId, lineItems: [{ description: "Consulting", quantity: 3, unitAmountCents: 15000, taxRateBps: 875 }] },
  { invoiceStore }
);
await issueInvoice({ invoiceId: draft.data.id, termsDays: 14 }, { invoiceStore, allocator }); // -> INV-00001
await createInvoicePaymentLink({ invoiceId: draft.data.id }, { invoiceStore, paymentLinkProvider });
await recordPayment({ invoiceId: draft.data.id, amountCents: 48938, idempotencyKey: stripeEventId }, { invoiceStore });

await createRecurringInvoiceTemplate(
  {
    tenantId,
    customerId,
    name: "Monthly retainer",
    startAt: "2026-07-01T00:00:00.000Z",
    frequency: "monthly",
    autoIssue: true,
    lineItems: [{ description: "Retainer", quantity: 1, unitAmountCents: 250000, taxRateBps: 0 }]
  },
  { recurringInvoiceStore }
);
await generateDueRecurringInvoices({ tenantId }, { invoiceStore, recurringInvoiceStore, allocator });
```

## Dunning

Run `generateDueRecurringInvoices({ tenantId })` and `dueForReminder({ invoiceStore })`
on **jobs-workflows** schedules. Recurring generation keys each occurrence by
`(tenantId, recurringTemplateId, recurringOccurrenceAt)`; reminder jobs should be
keyed on invoice id + date to send once.

## Resources

- D1 (`DB`): `invoices`, `invoice_line_items`, `invoice_sequences`, `invoice_payments`,
  `invoice_recurring_templates`, `invoice_recurring_template_line_items` (migration `0001`).
- Optional Stripe payment-link adapter: `createStripeInvoicePaymentLinkProvider`.

## Verification

```bash
pnpm --filter @microservices-sh/invoice build
pnpm --filter @microservices-sh/invoice check:spec
```
