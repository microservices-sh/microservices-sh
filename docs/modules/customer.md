# Customer Module

Status: `available`

Class: `core`

Mount: `/customers`

## Purpose

The Customer module manages customer profiles, contact fields, tags, consent fields, notes, and customer lifecycle events.

## When To Use

- Use for booking systems, stores, invoices, service businesses, CRMs, portals, and internal tools that need customer records.
- Use when downstream modules need a stable customer id.

## When Not To Use

- Do not use as a full CRM replacement in the MVP.
- Do not use for advanced deduplication, segmentation automation, or marketing campaigns yet.

## Dependencies

| Dependency | Required | Reason |
|------------|----------|--------|
| `auth` | Yes | Actor identity and permissions. |
| D1 binding `DB` | Yes | Stores customer records. |
| `email` | Optional | Customer notification workflows. |
| `audit-log` | Optional | Detailed mutation audit trail. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 table | `customers` | Yes | Customer profile and contact data. |
| D1 table | `domain_events` | Yes | Customer lifecycle events. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `CUSTOMER_PROFILE_FIELDS` | Var/config | module/env | No | Usually comes from app config instead of env. |

No module-private secret is required for the base Customer module.

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `customer.read` | List and read customer records. |
| `customer.write` | Create and update customer records. |
| `customer.admin` | Change customer schema/config or delete records. |

Risk level: `medium`

Approval required for:

- installing tables that store PII
- adding new PII fields
- exporting customer data
- deleting or merging customers
- production deployment

## Routes

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `GET` | `/customers` | Required | `customer.read` | List customers. |
| `POST` | `/customers` | Required | `customer.write` | Create a customer. |
| `GET` | `/customers/:id` | Required | `customer.read` | Read one customer. |
| `PATCH` | `/customers/:id` | Required | `customer.write` | Update a customer. |

## Payloads And Responses

### Create Customer

Request:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "phone": "+15551234567",
  "tags": ["vip"],
  "notes": "Prefers morning appointments",
  "consent": {
    "emailMarketingConsent": true
  }
}
```

Response:

```json
{
  "ok": true,
  "customer": {
    "id": "cus_123",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "phone": "+15551234567",
    "tags": ["vip"],
    "createdAt": 1791840000000
  }
}
```

### List Customers

Response:

```json
{
  "ok": true,
  "customers": [
    {
      "id": "cus_123",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "phone": "+15551234567"
    }
  ]
}
```

## Events

### Emits

| Event | Payload | Purpose |
|-------|---------|---------|
| `customer.created` | `customerId`, `email`, `source` | Trigger booking, CRM, email, or audit workflows. |
| `customer.updated` | `customerId`, `changedFields` | Trigger sync or audit workflows. |

### Consumes

| Event | Action |
|-------|--------|
| `auth.user_created` | Optionally create a linked customer profile. |

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `beforeCustomerCreate` | Pre | customer payload | normalized payload or validation error | Enforce custom fields and consent rules. |
| `afterCustomerUpdated` | Post | customer plus changed fields | side effects only | Sync to CRM or email provider. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `customers` | Stores customer contact and profile data. |
| `domain_events` | Stores customer lifecycle events in MVP generated apps. |

## Customization

Preferred order:

1. Config: profile fields, tags, segments, consent fields.
2. Hooks: normalize and validate customer payloads.
3. Overlay: custom list/search/filter routes.
4. Fork: deep CRM behavior.

## Upgrade Notes

- Adding fields should use config or migrations, not ad hoc table edits.
- PII field changes require approval and agent-readable migration notes.
- Export and delete flows must be explicit before production use in regulated contexts.

## Failure Modes

| Failure | Cause | Agent Remediation |
|---------|-------|-------------------|
| Duplicate email | Unique email constraint or business rule | Ask whether to update existing record or create a separate profile. |
| Invalid custom field | Config/schema mismatch | Update `customer` config and rerun validation. |
| PII approval missing | New sensitive field introduced | Request user approval before migration/deploy. |

## Agent Checklist

- Inspect configured profile and consent fields.
- Confirm whether email or phone is required.
- Confirm PII approval before production migration.
- Run customer create/list tests.
- Keep customer-specific business logic in hooks before editing module internals.

