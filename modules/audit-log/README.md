# Audit Log Module

The pure event sink for auth-gated apps (see
`plans/24-service-topology-and-auth-comms.md`). Append-only; never on the
synchronous business path.

## What it does

- **Records** any domain event into an append-only `audit_events` table.
- **Consumes** signed queue envelopes (`consumeEvent`) — verifies the HMAC
  signature (plans/24 layer 3) before recording when a secret is configured.
- **Lists** the trail for admins (`listEvents`, `audit.read`).

Records are never updated or deleted.

## Surface

| Use case | Scope | Purpose |
|----------|-------|---------|
| `recordEvent` | internal | Append one audit record (applies `redactAuditPayload`) |
| `consumeEvent` | internal (queue) | Verify a signed envelope, then record it |
| `listEvents` | `audit.read` | Read the audit trail with filters |

`signEnvelope` / `verifyEnvelope` (HMAC-SHA256) are exported for producers and
consumers of the event bus.

## Deps

Persistence is behind `AuditEventStore` (`src/ports`): `createD1AuditEventStore(db)`
for Cloudflare D1, `createMemoryAuditEventStore()` for tests.

## Security notes

- Use `redactAuditPayload` to strip PII before persistence.
- Set a per-tenant secret and `requireSignedEnvelope` in production so only
  signed events are recorded.
- Treat migrations, PII redaction, and production deploy as approval-gated.
