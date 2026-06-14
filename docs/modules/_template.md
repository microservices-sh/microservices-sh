# <Module Name>

Status: `<available|planned>`

Class: `<core|provider|template-support>`

Mount: `/<mount>`

## Purpose

Describe what business capability this module provides.

## When To Use

- Use this module when...

## When Not To Use

- Do not use this module when...

## Dependencies

| Dependency | Required | Reason |
|------------|----------|--------|
| `auth` | Yes | Actor identity and permissions. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 | `<table>` | Yes | Persistent records. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `<SECRET_NAME>` | Secret | module/env | Yes | Never exposed to agents. |

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `<module>.read` | Read records. |

Risk level: `<low|medium|high|critical>`

Approval required for:

- install
- secrets
- migrations
- production deploy

## Routes

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `GET` | `/<mount>` | Required | `<module>.read` | List records. |

## Payloads And Responses

### `<Route Name>`

Request:

```json
{}
```

Response:

```json
{ "ok": true }
```

## Events

### Emits

| Event | Payload | Purpose |
|-------|---------|---------|
| `<module>.created` | `{}` | Published after creation. |

### Consumes

| Event | Action |
|-------|--------|
| `<other>.created` | React to upstream change. |

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `beforeCreate` | Pre | request payload | modified payload or error | Validate business rules. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `<table>` | Stores module records. |

## Customization

Preferred order:

1. Config
2. Hooks
3. Overlays
4. Fork

## Upgrade Notes

- Config and hooks are expected to upgrade automatically.
- Route overlays require merge review.
- Forks require manual or agent-assisted upgrades.

## Failure Modes

| Failure | Cause | Agent Remediation |
|---------|-------|-------------------|
| Missing secret | Required secret not configured | Ask user to configure the secret in the secure UI. |

## Agent Checklist

- Inspect dependencies.
- Inspect secrets and vars.
- Confirm approval gates.
- Generate code.
- Run checks.
- Deploy preview only after approval.

