# Bank Reconciliation Operator

Use this skill when operating `@microservices-sh/bank-reconciliation`.

Workflow:

1. Create or select a bank account.
2. Import statement transactions with signed integer cents.
3. Review duplicate rows from the import result.
4. Suggest matches from ledger/payment references.
5. Create manual or auto matches.
6. Start a reconciliation session from the account's last reconciled balance.
7. Complete only after every in-period statement transaction is matched or excluded and the statement ending balance matches.

Do not post journals or mutate accounting-core from this module. Use emitted events or candidate-provider ports for integration.
