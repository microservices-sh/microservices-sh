# Estimate Quote Module

Status: `draft`

Tenant-scoped estimates and quotes for accounting, CRM, and service templates. The module owns quote numbering, draft edits, line-item totals in integer cents, send/view/accept/decline/expire/void transitions, and conversion metadata.

## Public Surface

```ts
import {
  createEstimateQuoteService,
  createD1EstimateQuoteStore,
  createEstimateQuoteMemoryStore
} from "@microservices-sh/estimate-quote";
```

## Ownership Boundary

This module owns estimate quote documents, line items, schemas, hooks, events, permissions, D1 migrations, and storage adapters.

Invoice creation stays outside this module. `convertEstimateQuote` records the supplied invoice id and returns an invoice draft payload that an invoice module or app adapter can persist.
