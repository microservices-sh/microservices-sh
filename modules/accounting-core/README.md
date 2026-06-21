# Accounting Core Module

Status: `draft`

Tenant-scoped double-entry accounting foundation with chart of accounts, fiscal periods, balanced posting, voiding, and trial balance.

## Public Surface

```ts
import {
  createMemoryAccountingCoreStore,
  createAccount,
  createFiscalPeriod,
  createJournalEntry,
  postJournalEntry,
  getTrialBalance
} from "@microservices-sh/accounting-core";
```

## Ownership Boundary

The module owns tenant-scoped chart of accounts, fiscal periods, journal entries, journal lines, posting, reversal-based voiding, trial balance, schemas, hooks, events, permissions, resources, and migrations for `accounting-core`.

Templates own app shell, route adapters, UI layout, auth context extraction, and framework-specific response mapping.

## Accounting Rules

Money is stored as integer cents. Journal lines must use exactly one non-zero debit or credit amount. Journal entries must balance before they can be saved or posted. Posting is rejected for closed or locked fiscal periods. A posted `sourceRef` is unique per tenant so upstream invoices, orders, and adjustments cannot post twice.

Posted entries are immutable. Voiding a posted entry marks the original as `void` and creates a posted reversal entry with swapped debit and credit lines; lines are never deleted to correct posted history.
