# Billing & Subscriptions

Status: available
Module ID: `billing-subscriptions`
Mount: `/billing`

## Summary
Recurring plans and subscription state on top of Stripe-compatible billing events. Handles the subscription status state machine, idempotent webhook application, plan changes, metered usage, and dunning hooks.

## Dependencies
- none

Optional integrations:

- payment
- org-team-rbac
- jobs-workflows
- audit-log

## Permissions
- billing.read
- billing.write
- billing.admin
- billing-subscriptions.extend
- billing-subscriptions.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- plans
- subscriptions
- billing_events
- usage_records

## Hooks
- beforeSubscriptionChange
- onSubscriptionActivated
- onSubscriptionPastDue

## Events
Emits:

- subscription.started
- subscription.activated
- subscription.past_due
- subscription.canceled
- subscription.plan_changed

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- money mutations
- production deploy behavior

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
