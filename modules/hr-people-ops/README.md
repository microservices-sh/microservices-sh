# HR People Ops Module

Status: `draft`

StackSuite HR-inspired employee directory, departments, positions, leave balances, leave request lifecycle, and attendance records for internal-ops templates.

## Public Surface

```ts
import {
  createHrPeopleOpsService,
  createD1HrPeopleOpsStore,
  createHrPeopleOpsMemoryStore
} from "@microservices-sh/hr-people-ops";
```

## Ownership Boundary

This module owns HR profile structure, leave accounting, leave approvals, and attendance metadata. It does not own payroll, benefits, local tax rules, auth sessions, or compliance-specific scheduling.

Leave balances are stored as integer hundredths of a day, not floating point day totals.
