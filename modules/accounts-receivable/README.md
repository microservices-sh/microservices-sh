# Accounts Receivable Module

Status: `draft`

Tenant-scoped customer payment application, open receivables, aging, and statement workflows.

## Public Surface

```ts
import {
  createAccountsReceivableMemoryService,
  createAccountsReceivableMemoryStore,
  createAccountsReceivableService
} from "@microservices-sh/accounts-receivable";
```

`createAccountsReceivableMemoryService()` preserves the synchronous in-memory API used by existing tests and local callers.

`createAccountsReceivableService({ store })` is the durable-adapter-ready path. Store adapters implement `AccountsReceivableStore`; the module currently ships `createAccountsReceivableMemoryStore()` for tests and local development.

## D1 Adapter Status

The current migration owns customer payments, payment applications, and domain events. A complete D1 adapter also needs durable invoice snapshots for open receivables, aging, and statement generation. No module-owned invoice snapshot table is present yet, so D1 should wait until that table contract is added or verified.

## Ownership Boundary

The module owns customer payment records, payment applications, reporting use cases, schemas, hooks, events, permissions, resources, and migrations for `accounts-receivable`.

Invoice, payment-provider, and accounting-core integration stays behind ports or emitted events. Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
