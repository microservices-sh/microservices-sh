# Bank Reconciliation Use Cases

- `createBankAccount`
- `listBankAccounts`
- `importStatementCsv`
- `listStatementImports`
- `importStatementTransactions`
- `listStatementTransactions`
- `suggestMatches`
- `createMatch`
- `unmatchTransaction`
- `excludeTransaction`
- `restoreExcludedTransaction`
- `startReconciliation`
- `completeReconciliation`
- `listReconciliations`

Transaction correction use cases reject already reconciled transactions. Excluded transactions are ignored by reconciliation unmatched checks and cleared-balance totals.

All use cases are side-effect-free outside their injected store and hooks.
