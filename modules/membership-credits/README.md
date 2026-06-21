# Membership Credits Module

Status: `draft`

Tenant-scoped membership tiers, active customer memberships, customer credit balances, credit ledger transactions, and membership history.

## Public Surface

```ts
import {
  createMembershipCreditsService,
  createMembershipCreditsMemoryStore,
  createD1MembershipCreditsStore
} from "@microservices-sh/membership-credits";
```

Money is stored as integer cents. Do not use floating-point values for credit balances.

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for `membership-credits`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
