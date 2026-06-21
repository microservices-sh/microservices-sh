# Accounts Receivable Adapters

Adapters implement `AccountsReceivableStore` for the store-backed service factory.

## Available

- `memory.ts`: in-memory `AccountsReceivableStore` for unit tests, local development, and compatibility checks.

## D1 Readiness

A D1 adapter should use prepared statements or `drizzle-orm/d1` behind `AccountsReceivableStore`, matching the repository data-access standard used by modules such as `booking`.

The current migration only creates:

- `ar_customer_payments`
- `ar_payment_applications`
- `domain_events`

The service also needs durable invoice snapshots for `upsertInvoiceSnapshot`, `listOpenReceivables`, aging, and statements. There is no existing `ar_invoice_snapshots` table or verified mapping to another module-owned invoice table in this module's migration. Because of that, a complete D1 adapter would be partial or would have to assume an unverified table contract.

Before adding D1 here, add or verify a module-owned invoice snapshot table with columns for the `InvoiceSnapshot` shape, including tenant/customer indexes and open-receivable query coverage.
