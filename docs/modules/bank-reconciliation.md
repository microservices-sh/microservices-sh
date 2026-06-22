# Bank Reconciliation

Status: draft
Module ID: `bank-reconciliation`
Mount: `/banking`

## Summary
Tenant-scoped bank accounts, statement import mapping presets, CSV preview/dedup review, bank transactions, ledger matching corrections, exclusions, provisional clear/unclear state, and reconciliation sessions with completion guards.

## Dependencies
- accounting-core
- optional: payment, accounts-payable, accounts-receivable, file-media

## Permissions
- bank-reconciliation.read
- bank-reconciliation.write
- bank-reconciliation.admin
- bank-reconciliation.extend
- bank-reconciliation.observe

## Resources
- D1

## Hooks
- beforeBankAccountCreate
- beforeStatementImport
- beforeMatchCreate
- beforeReconciliationStart
- beforeReconciliationComplete
- afterReconciliationChanged

## Events
- bank-reconciliation.bank_account_created
- bank-reconciliation.statement_imported
- bank-reconciliation.match_created
- bank-reconciliation.transaction_unmatched
- bank-reconciliation.transaction_excluded
- bank-reconciliation.transaction_restored
- bank-reconciliation.transaction_cleared
- bank-reconciliation.transaction_uncleared
- bank-reconciliation.reconciliation_started
- bank-reconciliation.reconciliation_completed

## Invariants
- Money is stored as integer cents.
- CSV imports use auto-detected headers, a module-owned field mapping preset, or an explicit custom field mapping.
- CSV previews use the same mapping rules as imports, return importable/duplicate/skipped row statuses, and do not write import history or statement transactions.
- Auto-detected and preset-based imports store the resolved field names plus detection/preset metadata in statement import history.
- Imported transaction hashes are unique per tenant and bank account.
- A transaction cannot be reconciled while unmatched.
- Reconciled transactions cannot be unmatched, excluded, or restored.
- Excluded transactions are ignored by reconciliation unmatched checks and cleared-balance totals.
- Clear/unclear is provisional and only allowed while the reconciliation session is in progress.
- Reconciliation completion requires the current-session cleared balance to match the statement balance.
- Ledger integration happens through ports or events, not direct accounting-core internals.

## Approval Gate
Risk: medium

Statement import, manual matching, transaction clear/unclear, reconciliation completion, migrations, and production deploys require explicit approval. CSV preview is read-only and does not require approval.
