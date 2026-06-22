# Bank Reconciliation Use Cases

- `createBankAccount`
- `listBankAccounts`
- `listStatementImportFieldMappingPresets`
- `detectStatementImportFieldMapping`
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

CSV imports may use auto-detected headers, a module-owned mapping preset, or a custom field mapping. Auto-detection and presets resolve to concrete column names before parsing and are stored in import history with `autoDetected` or `presetId`.

All use cases are side-effect-free outside their injected store and hooks.
