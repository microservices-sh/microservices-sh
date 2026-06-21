# Accounts Receivable Module

Status: `draft`

Tenant-scoped customer payment application, open receivables, aging, and statement workflows.

## Public Surface

```ts
import {
  createAccountsReceivableMemoryService,
  createAccountsReceivableMemoryStore,
  createD1AccountsReceivableStore,
  createAccountsReceivableService
} from "@microservices-sh/accounts-receivable";
```

`createAccountsReceivableMemoryService()` preserves the synchronous in-memory API used by existing tests and local callers.

`createAccountsReceivableService({ store })` is the durable-adapter-ready path. Store adapters implement `AccountsReceivableStore`; the module ships `createAccountsReceivableMemoryStore()` for tests and local development and `createD1AccountsReceivableStore(db)` for Cloudflare D1 runtimes.

## D1 Adapter Status

D1 is available through `createD1AccountsReceivableStore(db)` and package export `@microservices-sh/accounts-receivable/adapters/d1`.

The migration owns durable invoice snapshots, customer payments, payment applications, and domain events. Invoice snapshots are module-local reporting snapshots for open receivables, aging, and statements; the canonical invoice module remains the invoice system of record.

## Ownership Boundary

The module owns customer payment records, payment applications, reporting use cases, schemas, hooks, events, permissions, resources, and migrations for `accounts-receivable`.

Invoice, payment-provider, and accounting-core integration stays behind ports or emitted events. Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
