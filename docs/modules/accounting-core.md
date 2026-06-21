# Accounting Core

Status: draft
Module ID: `accounting-core`
Mount: `/accounting`

## Summary
Tenant-scoped double-entry accounting foundation with chart of accounts, fiscal periods, balanced posting, voiding, and trial balance.

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
- Fiscal periods transition only from open to closed, closed to open, or closed to locked.
- Locked fiscal periods cannot transition.
- Closed or locked fiscal periods reject posting.
- A posted source reference cannot be posted twice.
- Posted entries are not edited; voiding creates reversal behavior.
- Trial balance debit and credit totals must balance.

## Approval Gate
Risk: medium

Journal posting, voiding, migrations, production deploys, and accounting rule changes require explicit approval.
