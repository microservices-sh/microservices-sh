# Bank Reconciliation Operator

Use this skill when operating `@microservices-sh/bank-reconciliation`.

Workflow:

1. Create or select a bank account.
2. Preview CSV statements with `previewStatementImportCsv` to review importable, duplicate, and skipped rows.
3. Import approved statement transactions with signed integer cents.
4. Review duplicate rows from the import result.
5. Suggest matches from ledger/payment references.
6. Create manual or auto matches.
7. Start a reconciliation session from the account's last reconciled balance.
8. Complete only after every in-period statement transaction is matched or excluded and the statement ending balance matches.

Do not post journals or mutate accounting-core from this module. Use emitted events or candidate-provider ports for integration.
