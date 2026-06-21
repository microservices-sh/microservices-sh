# Recurring Documents Module

Status: `draft`

Recurring invoice and bill templates for accounting templates. The module owns schedule state, line-item totals in integer cents, active/paused/completed/cancelled lifecycle, due-run selection, and generated invoice/bill draft payloads.

## Public Surface

```ts
import {
  createRecurringDocumentsService,
  createD1RecurringDocumentsStore,
  createRecurringDocumentsMemoryStore
} from "@microservices-sh/recurring-documents";
```

## Ownership Boundary

This module does not persist real invoices or bills. It returns generated document drafts and updates recurrence tracking. App adapters or `invoice`/AP modules own final document creation, sending, approval, posting, and voiding.
