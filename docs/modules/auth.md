# Auth Module

Status: `available`

Class: `core`

Mount: `/auth`

## Purpose

The Auth module provides account identity, session creation, role assignment, route protection, and auth audit events for generated apps.

## When To Use

- Use when an app needs authenticated users, staff/admin roles, protected API routes, or customer account boundaries.
- Use as the default dependency for modules that need an actor identity or permission checks.

## When Not To Use

- Do not use as a full enterprise IAM replacement.
- Do not use for SSO, passkeys, SAML, or complex organization-level RBAC in the MVP.

## Dependencies

| Dependency | Required | Reason |
|------------|----------|--------|
| D1 binding `DB` | Yes | Stores users and sessions. |
| KV binding `CACHE_KV` | Yes | Stores short-lived session/cache records where configured. |
| `email` | Optional | Magic-link or OTP delivery. |
| `audit-log` | Optional | Dedicated audit trail beyond base events. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 table | `users` | Yes | Account profile and role. |
| D1 table | `sessions` | Yes | Active sessions. |
| D1 table | `domain_events` | Yes | Auth lifecycle events in generated MVP app. |
| KV | `CACHE_KV` | Yes | Session/cache support. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `SESSION_SECRET` | Secret | project/env | Production | Used for signed session tokens when token signing is enabled. |
| `AUTH_DEFAULT_ROLE` | Var | project/env | No | Defaults to `member`. |
| `AUTH_SESSION_TTL_SECONDS` | Var | project/env | No | Defaults to template config. |

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `auth.read` | Read users and sessions. |
| `auth.write` | Create users and sessions. |
| `auth.admin` | Manage roles and session policy. |

Risk level: `high`

Approval required for:

- installing auth in a production app
- changing session/token behavior
- adding or rotating `SESSION_SECRET`
- changing role or permission mappings
- production deployment

## Routes

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `POST` | `/auth/signup` | Public | `auth.write` | Create a user account. |
| `POST` | `/auth/session` | Public | `auth.write` | Create a session. |
| `POST` | `/auth/logout` | Required | `auth.write` | Revoke the current session. |
| `GET` | `/auth/me` | Required | `auth.read` | Return current actor profile. |

## Payloads And Responses

### Signup

Request:

```json
{
  "email": "owner@example.com",
  "name": "Studio Owner",
  "role": "owner"
}
```

Response:

```json
{
  "ok": true,
  "user": {
    "id": "usr_123",
    "email": "owner@example.com",
    "name": "Studio Owner",
    "role": "owner"
  }
}
```

### Current User

Response:

```json
{
  "ok": true,
  "user": {
    "id": "usr_123",
    "email": "owner@example.com",
    "role": "owner"
  }
}
```

## Events

### Emits

| Event | Payload | Purpose |
|-------|---------|---------|
| `auth.user_created` | `userId`, `email`, `role` | Downstream customer/profile creation. |
| `auth.session_created` | `userId`, `sessionId` | Audit and security monitoring. |
| `auth.session_revoked` | `userId`, `sessionId` | Audit and security monitoring. |

### Consumes

| Event | Action |
|-------|--------|
| None | Auth is a root module for identity. |

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `beforeSignup` | Pre | signup payload | modified payload or validation error | Enforce domain, invite, or role rules. |
| `afterSignup` | Post | created user | side effects only | Welcome flows, analytics, CRM sync. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Stores identity profile, email, name, and role. |
| `sessions` | Stores active session records or session references. |
| `domain_events` | Stores emitted auth events in MVP generated apps. |

## Customization

Preferred order:

1. Config: default role, allowed domains, session TTL.
2. Hooks: signup validation and post-signup sync.
3. Overlay: custom auth route behavior.
4. Fork: enterprise auth or custom identity provider.

## Upgrade Notes

- Config and hooks should remain upgradeable.
- Route overlays require merge review.
- Forked auth becomes user-owned and should not receive automatic security-sensitive upgrades without review.

## Failure Modes

| Failure | Cause | Agent Remediation |
|---------|-------|-------------------|
| Duplicate email | Existing user row | Return existing-account guidance or route to login. |
| Missing session secret | Production token signing not configured | Ask user to configure `SESSION_SECRET` in the secure UI. |
| Unauthorized route | Missing or invalid session | Confirm auth middleware is mounted before protected routes. |

## Agent Checklist

- Confirm role model and protected routes.
- Confirm whether email delivery is needed for OTP or magic links.
- Confirm `SESSION_SECRET` before production.
- Run auth route tests.
- Do not expose secret values in generated docs or chat.

