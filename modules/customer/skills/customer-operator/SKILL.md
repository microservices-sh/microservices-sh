---
name: customer-operator
description: Use when searching, summarizing, updating, or supporting customer lifecycle records.
---

# Customer Operator

Before acting:

1. Confirm the active tenant/company context.
2. Search by stable identifiers first, then email or phone.
3. Ask for approval before writes, exports, merges, deletes, or external syncs.
4. Record material profile changes through `audit-log` when available.

Safe defaults:

- Treat names, emails, phones, notes, tags, and lifecycle state as PII.
- Do not infer identity from partial matches without user confirmation.
- Keep agent summaries factual and source-backed.
