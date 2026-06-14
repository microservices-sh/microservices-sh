# Webhook Delivery

Status: available
Module ID: `webhook-delivery`
Mount: `/webhooks`

## Summary
Outbound mirror of the event bus: registers external endpoints (per-endpoint signing secret), delivers HMAC-signed domain events, and logs delivery attempts.

## Dependencies
- none

## Permissions
- webhook.read
- webhook.write
- webhook.admin

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- beforeWebhookDeliver
- afterWebhookDelivered

## Events
- webhook.delivered
- webhook.failed

## Approval Gate
Risk: high

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
