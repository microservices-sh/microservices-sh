# Bank Reconciliation Module

Status: `draft`

Tenant-scoped bank accounts, statement imports, transaction matching, and reconciliation completion with integer-cent balances.

## Public Surface

```ts
import {
  createBankReconciliationService,
  createMemoryBankReconciliationStore
} from "@microservices-sh/bank-reconciliation";

const service = createBankReconciliationService({
  store: createMemoryBankReconciliationStore()
});
```

## Core Behavior

- Creates and lists tenant/org-scoped bank accounts.
- Imports mapped CSV statements into persisted import sessions.
- Imports prepared signed statement transactions in integer cents.
- Lists statement import history with row, duplicate, skipped, date-range, and uploader metadata.
- Guards duplicate statement transactions by stable transaction hash per tenant and bank account.
- Suggests matches from supplied ledger/payment candidates or an optional `MatchCandidateProvider`.
- Creates manual, auto, or rule matches without importing accounting-core or payment code.
- Starts reconciliation sessions from the account's last reconciled balance.
- Lists persisted reconciliation sessions by tenant or bank account.
- Completes reconciliation only when all in-period non-excluded transactions are matched and the computed cleared balance equals the statement ending balance.

## Ownership Boundary

This module owns bank accounts, statement imports, statement transactions, reconciliation matches, reconciliation sessions, schemas, hooks, events, permissions, resources, and migrations.

Accounting-core and payment integrations should be provided through match candidate ports or consumed event payloads. Do not modify accounting-core from this module.
