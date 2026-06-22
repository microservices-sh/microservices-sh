# Accounting Core Module

Status: `draft`

Tenant-scoped double-entry accounting foundation with chart of accounts, fiscal periods, balanced posting, voiding, trial balance, general ledger, and financial statements.

## Public Surface

```ts
import {
  createMemoryAccountingCoreStore,
  createAccount,
  getAccount,
  updateAccountingSettings,
  createFiscalPeriod,
  closeFiscalPeriod,
  getFiscalPeriod,
  listFiscalPeriods,
  lockFiscalPeriod,
  reopenFiscalPeriod,
  createJournalEntry,
  postJournalEntry,
  getTrialBalance,
  getGeneralLedger,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement
} from "@microservices-sh/accounting-core";
```

## Ownership Boundary

The module owns tenant-scoped accounting setup settings, chart of accounts, GAAP/IFRS seed packs with base-currency normalization, fiscal periods, journal entries, journal lines, posting, reversal-based voiding, trial balance, financial statement read models, schemas, hooks, events, permissions, resources, and migrations for `accounting-core`.

Templates own app shell, route adapters, UI layout, auth context extraction, and framework-specific response mapping.

## Accounting Rules

Money is stored as integer cents. Journal lines must use exactly one non-zero debit or credit amount. Journal entries must balance before they can be saved or posted. Posting is rejected for closed or locked fiscal periods. A posted `sourceRef` is unique per tenant so upstream invoices, orders, and adjustments cannot post twice.

Fiscal periods carry a `periodType` of `month`, `quarter`, `year`, or `custom`. Fiscal-period lifecycle follows source StackSuite close semantics: open periods can close, closed periods can reopen or lock, and locked periods cannot transition. Closing records `closedById` when an actor is supplied; reopening clears close metadata. Lifecycle writes use compare-and-set status guards so stale close, reopen, and lock attempts return `accounting-core.FISCAL_PERIOD_TRANSITION_CONFLICT` without emitting a status-change event. Same-status updates and direct open-to-locked transitions return `accounting-core.INVALID_FISCAL_PERIOD_TRANSITION`.

Accounting setup settings persist chart standard, fiscal-year start month, base currency, and source-style default AR/AP/income/deposit account IDs, including an optional Stripe deposit override. Chart seeding maps the standard `1200`, `2110`, `4100`, and `1120` accounts into settings automatically; operator updates validate same-tenant active non-header account type compatibility before writing.

Posted entries are immutable. Voiding a posted entry marks the original as `void` and creates a posted reversal entry with swapped debit and credit lines; lines are never deleted to correct posted history.

Reporting includes trial balance, source-style general ledger, income statement, balance sheet, and cash-flow read models. General ledger reports are scoped by tenant and account, can filter by fiscal period or date range, and compute opening, running, and closing balances in integer cents using the account's normal balance.

Income statements aggregate date-bounded posted journal activity for revenue and expense accounts. Balance sheets aggregate as-of assets, liabilities, and equity, adding a synthetic current earnings line for unclosed revenue-expense balances. Cash-flow statements use reconcilable asset accounts plus configured deposit accounts as cash accounts, classify known source types, and keep unclassified cash activity explicit.
