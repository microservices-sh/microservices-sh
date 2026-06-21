# Bank Reconciliation

Status: draft
Module ID: `bank-reconciliation`
Mount: `/banking`

## Summary
Tenant-scoped bank accounts, statement imports, bank transactions, ledger matching, and reconciliation sessions with completion guards.

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
- beforeTransactionMatch
- beforeReconciliationComplete
- afterBankReconciliationChanged

## Events
- bank-reconciliation.bank_account_created
- bank-reconciliation.statement_imported
- bank-reconciliation.match_created
- bank-reconciliation.reconciliation_started
- bank-reconciliation.reconciliation_completed

## Invariants
- Money is stored as integer cents.
- Imported transaction hashes are unique per tenant and bank account.
- A transaction cannot be reconciled while unmatched.
- Reconciliation completion requires the cleared balance to match the statement balance.
- Ledger integration happens through ports or events, not direct accounting-core internals.

## Approval Gate
Risk: medium

Statement import, manual matching, reconciliation completion, migrations, and production deploys require explicit approval.
