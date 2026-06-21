# Accounting Core Module

Status: `draft`

Tenant-scoped double-entry accounting foundation with chart of accounts, fiscal periods, balanced posting, voiding, and trial balance.

## Public Surface

```ts
import {
  createMemoryAccountingCoreStore,
  createAccount,
  getAccount,
  createFiscalPeriod,
  closeFiscalPeriod,
  getFiscalPeriod,
  listFiscalPeriods,
  lockFiscalPeriod,
  reopenFiscalPeriod,
  createJournalEntry,
  postJournalEntry,
  getTrialBalance
} from "@microservices-sh/accounting-core";
```

## Ownership Boundary

The module owns tenant-scoped chart of accounts, GAAP/IFRS seed packs with base-currency normalization, fiscal periods, journal entries, journal lines, posting, reversal-based voiding, trial balance, schemas, hooks, events, permissions, resources, and migrations for `accounting-core`.

Templates own app shell, route adapters, UI layout, auth context extraction, and framework-specific response mapping.

## Accounting Rules

Money is stored as integer cents. Journal lines must use exactly one non-zero debit or credit amount. Journal entries must balance before they can be saved or posted. Posting is rejected for closed or locked fiscal periods. A posted `sourceRef` is unique per tenant so upstream invoices, orders, and adjustments cannot post twice.

Fiscal periods carry a `periodType` of `month`, `quarter`, `year`, or `custom`. Fiscal-period lifecycle follows source StackSuite close semantics: open periods can close, closed periods can reopen or lock, and locked periods cannot transition. Closing records `closedById` when an actor is supplied; reopening clears close metadata. Same-status updates and direct open-to-locked transitions return `accounting-core.INVALID_FISCAL_PERIOD_TRANSITION`.

Posted entries are immutable. Voiding a posted entry marks the original as `void` and creates a posted reversal entry with swapped debit and credit lines; lines are never deleted to correct posted history.
