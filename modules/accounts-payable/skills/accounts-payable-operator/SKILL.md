# Accounts Payable Operator

Use this skill for accounts payable operations.

- Confirm tenant scope before listing or mutating records.
- Require approval for bill creation, payable transitions, accounting posting, and payment recording.
- Approve bills before posting them; post bills to accounting before recording accounting-backed payments.
- Void only unpaid bills; posted bills must go through accounting-core reversal semantics before AP status is voided.
- Use `voidBillPayment` to reverse payment applications. Journaled payments must go through accounting-core reversal semantics before AP balances are restored.
- Use `idempotencyKey` when recording payments from external systems.
- Do not apply payments above a bill's open balance.
