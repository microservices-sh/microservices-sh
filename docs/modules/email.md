# Email Module

Status: `available`

Class: `provider`

Mount: `/emails`

## Purpose

The Email module provides transactional email delivery ports, provider adapters, delivery tracking, and email-related events. Current provider adapters include Resend and the StackSuite email service backed by AWS SES over HTTP.

## When To Use

- Use for booking confirmations, cancellations, receipts, admin notifications, OTP/magic links, invoice reminders, and transactional lifecycle emails.
- Use when modules need a normalized email-sending interface and audit trail.

## When Not To Use

- Do not use for marketing campaigns or newsletters in the MVP.
- Do not use for inbox sync or full helpdesk workflows yet.

## Dependencies

| Dependency | Required | Reason |
|------------|----------|--------|
| D1 binding `DB` | Yes | Stores email jobs and delivery events. |
| `audit-log` | Optional | Detailed delivery/audit trail. |
| Provider module/config | Yes | Resend or StackSuite email service configuration. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 table | `email_deliveries` | Yes | Tracks queued/sent/failed delivery attempts. |
| D1 table | `domain_events` | Yes | Records email lifecycle events. |
| Outbound fetch | `api.resend.com` | Provider-specific | Required only for the Resend adapter. |
| Outbound fetch | `*.execute-api.amazonaws.com` | Provider-specific | Required only for the StackSuite email service adapter. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `EMAIL_PROVIDER` | Var | module/env | Yes | Example: `resend` or `stacksuite`. |
| `EMAIL_FROM` | Var | module/env | Yes | Verified sender address. |
| `RESEND_API_KEY` | Secret | module/env | Provider-specific | Required only for Resend provider. |
| `EMAIL_SERVICE_API_KEY` | Secret | module/env | Provider-specific | Required only for the StackSuite email service provider. |

Sender domain onboarding remains a production gate.

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `email.read` | Read templates and delivery state. |
| `email.write` | Enqueue and send transactional emails. |
| `email.admin` | Change providers, senders, and templates. |

Risk level: `medium`

Approval required for:

- configuring sender identity
- adding provider API secrets
- sending production emails
- enabling auth emails such as OTP/magic links
- changing templates that affect legal/payment/customer communication

## Routes

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `GET` | `/emails/templates` | Required | `email.read` | List templates. |
| `POST` | `/emails/send` | Required | `email.write` | Send or enqueue a transactional email. |
| `GET` | `/emails/:id` | Required | `email.read` | Read message status. |
| `POST` | `/webhooks/email/:provider` | Provider signed | Internal | Process delivery webhooks where supported. |

## Payloads And Responses

### Send Email

Request:

```json
{
  "template": "booking.confirmed",
  "to": "customer@example.com",
  "data": {
    "customerName": "Ada",
    "serviceName": "Consultation",
    "startsAt": "2026-07-01T10:00:00.000Z"
  }
}
```

Response:

```json
{
  "ok": true,
  "message": {
    "id": "eml_123",
    "status": "queued",
    "template": "booking.confirmed"
  }
}
```

## Events

### Emits

| Event | Payload | Purpose |
|-------|---------|---------|
| `email.queued` | `messageId`, `template`, `to` | Track async send. |
| `email.sent` | `messageId`, `providerMessageId` | Audit delivery handoff. |
| `email.failed` | `messageId`, `reason` | Trigger retry or admin notification. |

### Consumes

None by default. Templates or app adapters can call the email module in response to booking, payment, invoice, or auth events.

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `beforeEmailSend` | Pre | email message | modified message or validation error | Enforce sender and recipient rules. |
| `afterEmailQueued` | Post | queued delivery event | side effects only | Observe accepted delivery attempts. |
| `afterEmailFailed` | Post | failure event | side effects only | Notify admin or queue retry. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `email_deliveries` | Stores provider, recipients, subject, idempotency key, status, provider message id, metadata, and error details. |
| `domain_events` | Stores email lifecycle events using the shared event schema. |

## Customization

Preferred order:

1. Config: provider, sender, templates, reply-to.
2. Hooks: validate recipient, observe queued sends, handle failures.
3. Overlay: custom email routes.
4. Fork: custom provider implementation.

## Upgrade Notes

- Provider credentials and sender verification should not be stored in source code.
- Template changes should be versioned where they affect legal/payment communication.
- Marketing email support should remain out of MVP scope.

## Failure Modes

| Failure | Cause | Agent Remediation |
|---------|-------|-------------------|
| Missing provider | No provider configured | Ask user to choose provider and configure required secrets/bindings. |
| Sender not verified | Provider/domain setup incomplete | Show provider-specific sender verification steps. |
| Send failed | Provider API error or rejected recipient | Record `email.failed` and expose retry guidance. |
| Template missing | Template id not found | Generate or configure the missing template. |

## Agent Checklist

- Confirm provider choice.
- Confirm sender/domain verification.
- Confirm required secrets or bindings exist.
- Confirm transactional templates.
- Run email send and delivery-record tests in preview before production.
