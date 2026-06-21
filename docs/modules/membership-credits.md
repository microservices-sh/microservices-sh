# Membership Credits

Status: draft
Module ID: `membership-credits`
Mount: `/membership-credits`

## Summary
Tenant-scoped membership tiers, customer memberships, credit balances, credit ledger transactions, and membership history.

## Dependencies
- none

Optional integrations:

- auth
- audit-log
- booking
- customer
- payment
- billing-subscriptions

## Permissions
- membership-credits.read
- membership-credits.write
- membership-credits.credit-admin
- membership-credits.membership-admin
- membership-credits.admin
- membership-credits.extend
- membership-credits.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- membership_credit_tiers
- customer_memberships
- customer_credit_balances
- credit_transactions
- membership_history
- domain_events

## Hooks
- beforeMembershipCreditsCreate
- afterMembershipCreditsUpdated

## Events
Emits:

- membership-credits.tier_created
- membership-credits.membership_assigned
- membership-credits.membership_changed
- membership-credits.membership_cancelled
- membership-credits.membership_expired
- membership-credits.credit_recorded

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- PII fields
- production deploy behavior
- external side effects
- credit balance changes
- membership tier changes

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
