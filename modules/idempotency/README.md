# Idempotency Module

Status: `available`

Reusable idempotency records for safely deduplicating retries, webhooks, jobs,
payments, forms, booking actions, invoice actions, and other at-least-once
operations.

## Purpose

This module gives other modules a shared way to answer one production-critical
question: should this side effect run, replay, wait, or fail closed?

It owns a D1-backed `idempotency_records` table keyed by `(scope, key)`. Callers
claim a scoped key before a side effect, then mark the record completed or failed.
Later retries with the same key replay the stored terminal result instead of
running the side effect again.

## When To Use

- Stripe, provider, or partner webhooks can be delivered more than once.
- Queue or cron jobs can run at least once and need a duplicate guard.
- Form submissions, booking creation, invoice issuance, or email sends need a
  client-provided idempotency key.
- A module needs request-hash conflict detection so one key cannot be reused for
  a different payload.

## When Not To Use

- Pure reads.
- Simple UI-only dedupe that does not protect a side effect.
- Long-running workflows that need step orchestration; use `jobs-workflows` and
  call this module for operation-level dedupe.

## Dependencies

Required: none.

Optional:

- `audit-log` to record claim/replay/completion/failure events.
- `jobs-workflows` to prune expired records on a schedule.
- `auth` or `gateway` when exposed through a host route.

## Runtime And Resources

| Resource | Binding | Tables |
|----------|---------|--------|
| D1 | `DB` | `idempotency_records` |

No secrets, outbound network calls, queues, or R2 buckets are required.

## Permissions And Approval Gates

Permissions:

- `idempotency.claim`
- `idempotency.read`
- `idempotency.admin`
- `idempotency.extend`
- `idempotency.observe`

Approval gates:

- D1 migration
- PII fields in stored `response`, `error`, or `metadata`
- retention policy changes
- production deploy

## Routes

The module is framework-neutral. Host apps own route mounting. Suggested route
shapes are documented in `openapi.json`:

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `POST` | `/idempotency/claim` | Required | `idempotency.claim` | Claim a scoped key before running a side effect. |
| `POST` | `/idempotency/complete` | Required | `idempotency.claim` | Store the replay response for a completed operation. |
| `POST` | `/idempotency/fail` | Required | `idempotency.claim` | Store the replay error for a failed operation. |

## Payloads And Responses

Claim:

```json
{
  "scope": "payment.intent",
  "key": "idem_123",
  "requestHash": "sha256-abc",
  "ttlMs": 86400000,
  "lockTtlMs": 60000,
  "metadata": { "customerId": "cus_123" }
}
```

Claim response when the caller may run the side effect:

```json
{
  "action": "claimed",
  "replayed": false,
  "record": { "status": "in_progress" }
}
```

Claim response when a terminal result is replayed:

```json
{
  "action": "replayed",
  "replayed": true,
  "record": {
    "status": "completed",
    "response": { "paymentId": "pay_123" }
  }
}
```

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

## Database Tables

`idempotency_records`

- `scope`, `key`: unique operation identity.
- `request_hash`: optional payload hash; mismatch fails with 409.
- `status`: `in_progress`, `completed`, or `failed`.
- `response_json`, `error_json`: replay payloads for terminal states.
- `locked_until`: duplicate callers wait while a claim is active.
- `expires_at`: cleanup and eventual key reuse boundary.

## Customization

Use hooks for validation, metadata shaping, audit fanout, or domain-specific
replay behavior. Do not store secret values in metadata or replay payloads.

## Upgrade Notes

The public contract is the scoped key state machine. Schema upgrades must preserve
`UNIQUE(scope, key)` and terminal replay semantics.

## Failure Modes

- Duplicate caller while operation is running: returns `action: "in_progress"`.
- Duplicate caller after completion/failure: returns `action: "replayed"`.
- Same key with a different request hash: fails with
  `idempotency.KEY_REUSED_WITH_DIFFERENT_REQUEST`.
- Stale lock after `lockTtlMs`: a new caller can reclaim the key.
- Expired record after `ttlMs`: cleanup can delete it and the key can be used
  again.

## Agent Checklist

1. Call `claimIdempotency` before the side effect.
2. Only run the side effect when `action === "claimed"`.
3. Call `completeIdempotency` after success.
4. Call `failIdempotency` after a terminal failure you want replayed.
5. Use a stable `scope` and high-entropy key.
6. Use `requestHash` for payload conflict detection.
7. Do not store secrets in replay payloads or metadata.
