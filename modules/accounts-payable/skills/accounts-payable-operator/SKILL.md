# Accounts Payable Operator

Use this skill for accounts payable operations.

- Confirm tenant scope before listing or mutating records.
- Require approval for bill creation, payable transitions, and payment recording.
- Use `idempotencyKey` when recording payments from external systems.
- Do not apply payments above a bill's open balance.
