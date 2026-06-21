# Accounting Core

Status: draft
Module ID: `accounting-core`
Mount: `/accounting`

## Summary
Tenant-scoped double-entry accounting foundation with setup settings, chart of accounts, fiscal periods, balanced posting, voiding, and trial balance.

## Dependencies
- none required

## Permissions
- accounting-core.read
- accounting-core.write
- accounting-core.admin
- accounting-core.extend
- accounting-core.observe

## Resources
- D1

## Hooks
- beforeAccountCreate
- beforeFiscalPeriodCreate
- beforeJournalEntryCreate
- beforeJournalEntryPost
- beforeJournalEntryVoid
- afterJournalEntryChanged

## Events
- accounting-core.account_created
- accounting-core.fiscal_period_created
- accounting-core.fiscal_period_status_changed
- accounting-core.journal_entry_created
- accounting-core.journal_entry_updated
- accounting-core.journal_entry_posted
- accounting-core.journal_entry_voided

## Invariants
- Posted journal entries must balance in integer cents.
- Chart setup supports GAAP and IFRS seed packs and normalizes the chosen base currency onto created accounts.
- Accounting settings persist chart standard, base currency, fiscal-year start month, and source-style default AR/AP/income accounts.
- Fiscal periods carry a type (`month`, `quarter`, `year`, or `custom`) and close actor metadata.
- Fiscal-period lifecycle writes use compare-and-set status guards so stale close/reopen/lock attempts fail without event emission.
- Fiscal periods transition only from open to closed, closed to open, or closed to locked.
- Locked fiscal periods cannot transition.
- Closed or locked fiscal periods reject posting.
- A posted source reference cannot be posted twice.
- Posted entries are not edited; voiding creates reversal behavior.
- Trial balance debit and credit totals must balance.
- General ledger reports are tenant/account scoped and compute account-normal opening, running, and closing balances from posted and void journal lines.

## Approval Gate
Risk: medium

Journal posting, voiding, migrations, production deploys, and accounting rule changes require explicit approval.
