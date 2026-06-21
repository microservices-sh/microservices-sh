# Agent Guide: Invoice Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `InvoiceStore` and number allocation behind
   `NumberAllocator`. Never make real I/O in tests — use `createMemoryInvoiceStore()`
   and `createMemoryNumberAllocator()`.
3. Preserve the correctness invariants — they are the reason this module exists:
   - **Atomic numbering**: keep allocation in the `NumberAllocator` port. Never
     compute numbers with `MAX(number)+1` or a read-then-write in a use case.
     Allocate only at issue, after the abort hook, so aborts waste no numbers.
   - **Immutability**: editing/adding line items is allowed only while `draft`.
   - **Idempotent payments**: keep the `idempotencyKey` dedup via `recordPaymentKey`.
   - **Payment links**: create links only through the `InvoicePaymentLinkProvider`
     port, pass a deterministic provider idempotency key, and keep repeat calls
     idempotent once link metadata exists.
   - **Money is integer cents**; tax rounds per line via `totals.ts`. No floats.
   - **Void, never delete**; paid invoices cannot be voided (credit note instead).
4. Risk `high`: migrations, money mutations, and production deploy are approval-gated.
5. Run `pnpm --filter @microservices-sh/invoice build` and `check:spec` after edits.
