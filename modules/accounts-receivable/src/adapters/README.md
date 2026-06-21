# Accounts Receivable Adapters

Adapters implement `AccountsReceivableStore` for the store-backed service factory.

## Available

- `memory.ts`: in-memory `AccountsReceivableStore` for unit tests, local development, and compatibility checks.
- `d1.ts`: Cloudflare D1 `AccountsReceivableStore` for durable invoice snapshots, customer payments, payment applications, open receivables, aging, and statements.

## D1 Table Contract

D1 uses prepared statements behind `AccountsReceivableStore`, matching the repository data-access style used by adjacent modules.

The migration creates:

- `ar_invoice_snapshots`
- `ar_customer_payments`
- `ar_payment_applications`
- `domain_events`

`ar_invoice_snapshots` is a reporting snapshot table, not the canonical invoice source of truth. Keep invoice-system integration behind `upsertInvoiceSnapshot` or future event consumers.
