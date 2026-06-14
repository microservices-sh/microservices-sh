# Audit Log Module

Status: `planned`

Class: `core`

Mount: `/audit`

## Purpose

The Audit Log module records important mutations and domain events with actor, action, resource, request id, metadata, and before/after snapshots where available.

## When To Use

- Use for production apps where users need traceability for auth, customer, booking, payment, admin, or settings changes.
- Use as a base trust layer for agent-generated business systems.

## When Not To Use

- Do not treat the MVP audit log as an immutable compliance ledger.
- Do not use it as a full SIEM or security analytics product.

## Dependencies

| Dependency | Required | Reason |
|------------|----------|--------|
| `auth` | Recommended | Actor identity. |
| D1 binding `DB` | Yes | Stores audit records. |
| R2 | Optional | Long-term exports. |
| Queue `AUDIT_QUEUE` | Optional | Async export or external sink delivery. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 table | `audit_events` | Yes | Stores audit records. |
| D1 table | `domain_events` | Optional | Stores business lifecycle events. |
| R2 bucket | `AUDIT_EXPORTS` | Optional | Export bundles. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `AUDIT_RETENTION_DAYS` | Var | project/env | No | Retention policy. |
| `AUDIT_EXPORT_SIGNING_SECRET` | Secret | project/env | Optional | Signed export links, if enabled. |

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `audit.read` | Read audit records. |
| `audit.export` | Export audit logs. |
| `audit.admin` | Change retention and sink configuration. |

Risk level: `medium`

Approval required for:

- changing retention policy
- exporting audit data
- deleting audit data
- adding external sinks
- production deployment

## Routes

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `GET` | `/audit/events` | Required | `audit.read` | Search audit events. |
| `GET` | `/audit/events/:id` | Required | `audit.read` | Read one audit event. |
| `POST` | `/audit/export` | Required | `audit.export` | Create an audit export. |

## Payloads And Responses

### Search Events

Request query:

```text
GET /audit/events?resource=booking&resourceId=bok_123
```

Response:

```json
{
  "ok": true,
  "events": [
    {
      "id": "aud_123",
      "actorId": "usr_123",
      "action": "booking.cancelled",
      "resource": "booking",
      "resourceId": "bok_123",
      "requestId": "req_123",
      "createdAt": 1791840000000
    }
  ]
}
```

### Record Event

Internal service call:

```json
{
  "actorId": "usr_123",
  "action": "customer.updated",
  "resource": "customer",
  "resourceId": "cus_123",
  "before": { "tags": [] },
  "after": { "tags": ["vip"] }
}
```

Response:

```json
{
  "ok": true,
  "auditEventId": "aud_123"
}
```

## Events

### Emits

| Event | Payload | Purpose |
|-------|---------|---------|
| `audit.recorded` | `auditEventId`, `action`, `resource` | Internal observability. |
| `audit.export_created` | `exportId`, `requestedBy` | Export tracking. |

### Consumes

| Event | Action |
|-------|--------|
| `auth.*` | Record auth lifecycle events. |
| `customer.*` | Record customer mutations. |
| `booking.*` | Record booking lifecycle events. |
| `payment.*` | Record payment lifecycle events. |

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `redactAuditPayload` | Pre | audit payload | redacted payload | Remove sensitive fields before persistence. |
| `beforeAuditExport` | Pre | export request | approved request or error | Enforce export policy. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `audit_events` | Stores actor/action/resource records. |
| `domain_events` | Stores business events where the app uses event sourcing-style records. |

## Customization

Preferred order:

1. Config: retention, redaction fields, export availability.
2. Hooks: payload redaction and export policy.
3. Overlay: custom search/export routes.
4. Fork: immutable ledger or external SIEM behavior.

## Upgrade Notes

- Do not remove audit fields without migration and export notes.
- Redaction changes can affect compliance expectations and require approval.
- Immutable ledger guarantees are not part of MVP unless explicitly built.

## Failure Modes

| Failure | Cause | Agent Remediation |
|---------|-------|-------------------|
| Missing actor | System or unauthenticated action | Use `actorType=system` or record anonymous context. |
| Sensitive payload | Before/after contains secrets or PII | Apply `redactAuditPayload` hook and rerun checks. |
| Export blocked | Approval missing | Request user approval for export. |

## Agent Checklist

- Confirm which modules emit audit events.
- Confirm redaction rules.
- Confirm retention policy.
- Confirm export requirements.
- Run mutation tests that assert audit records are created.

