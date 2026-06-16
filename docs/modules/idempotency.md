# Idempotency

Status: Available

Reusable idempotency records for safely deduplicating retries, webhooks, jobs,
payments, forms, and other at-least-once operations.

## Purpose

`idempotency` protects side effects with scoped keys. A caller claims
`(scope, key)` before running work, then completes or fails the record. Replays
return the stored terminal result.

## Runtime And Resources

- D1 binding: `DB`
- Table: `idempotency_records`
- No secrets or outbound provider calls.

## Permissions

- `idempotency.claim`
- `idempotency.read`
- `idempotency.admin`
- `idempotency.extend`
- `idempotency.observe`

## Events

- `idempotency.claimed`
- `idempotency.replayed`
- `idempotency.completed`
- `idempotency.failed`
- `idempotency.expired_pruned`

## Hooks

- `beforeIdempotencyClaim`
- `afterIdempotencyComplete`
- `afterIdempotencyFail`
- `onIdempotencyReplay`

## Agent Checklist

1. Claim before the side effect.
2. Only run work on `action: "claimed"`.
3. Complete or fail terminal results.
4. Use `requestHash` to prevent key reuse with different payloads.
5. Do not store secrets in replay payloads.
