# In-App Notifications

Status: available
Module ID: `notifications-inapp`
Mount: `/notifications`

## Summary
Per-user in-app notification feed with scoped lists and counts, read/unread
state, typed payloads, reconnect catch-up via `sinceIso`, and idempotent
delivery through `dedupKey`. Realtime transport is owned by the host app.

## Dependencies
- none

## Permissions
- notifications.read
- notifications.write
- notifications.admin
- notifications-inapp.extend

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- notifications

## Hooks
- beforeNotify
- renderNotification

## Events
Emits:

- notification.created
- notification.read

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- production deploy behavior

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
