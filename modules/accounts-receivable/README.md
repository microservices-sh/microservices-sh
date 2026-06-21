# Accounts Receivable Module

Status: `draft`

Tenant-scoped customer payment application, open receivables, aging, and statement workflows.

## Public Surface

```ts
import {
  recordCustomerPayment,
  applyPaymentToInvoices,
  listOpenReceivables,
  generateAgedReceivables,
  produceCustomerStatement
} from "@microservices-sh/accounts-receivable";
```

## Ownership Boundary

The module owns customer payment records, payment applications, reporting use cases, schemas, hooks, events, permissions, resources, and migrations for `accounts-receivable`.

Invoice, payment-provider, and accounting-core integration stays behind ports or emitted events. Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
