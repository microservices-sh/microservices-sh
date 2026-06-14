# Email Module

Status: `planned`

Class: `provider-capable core`

Mount: `/emails`

## Purpose

The Email module provides transactional email templates, send jobs, provider adapters, delivery status tracking, and email-related events. Provider implementations can use Cloudflare Email Sending, Resend, Postmark, SendGrid, or another approved provider.

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
| Queue `EMAIL_QUEUE` | Recommended | Async email sending. |
| `audit-log` | Optional | Detailed delivery/audit trail. |
| Provider module/config | Yes | Cloudflare Email, Resend, Postmark, or similar. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 table | `email_templates` | Yes | Stores template definitions or references. |
| D1 table | `email_messages` | Yes | Tracks sent/pending/failed emails. |
| Queue | `EMAIL_QUEUE` | Recommended | Sends outside request path. |
| Binding | `EMAIL` | Provider-specific | Cloudflare Email Sending binding if used. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `EMAIL_PROVIDER` | Var | module/env | Yes | Example: `cloudflare-email`, `resend`, `postmark`. |
| `EMAIL_FROM` | Var | module/env | Yes | Verified sender address. |
| `RESEND_API_KEY` | Secret | module/env | Provider-specific | Required only for Resend provider. |
| `POSTMARK_SERVER_TOKEN` | Secret | module/env | Provider-specific | Required only for Postmark provider. |

Cloudflare Email Sending can use a Worker binding instead of an API key. Sender domain onboarding remains a production gate.

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `email.read` | Read templates and delivery state. |
| `email.write` | Enqueue and send transactional emails. |
| `email.admin` | Change providers, senders, and templates. |

Risk level: `high`

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

| Event | Action |
|-------|--------|
| `booking.confirmed` | Send confirmation email. |
| `booking.cancelled` | Send cancellation email. |
| `payment.succeeded` | Send receipt email. |

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `renderTemplate` | Compute | template id and data | subject, text, html | Customize email rendering. |
| `beforeEmailSend` | Pre | email message | modified message or validation error | Enforce sender and recipient rules. |
| `afterEmailFailed` | Post | failure event | side effects only | Notify admin or queue retry. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `email_templates` | Stores template metadata or custom templates. |
| `email_messages` | Stores email job and delivery status. |

## Customization

Preferred order:

1. Config: provider, sender, templates, reply-to.
2. Hooks: render template, validate recipient, failure handling.
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
- Run email queue/send tests in preview before production.

