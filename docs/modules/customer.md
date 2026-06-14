# Customer

Status: available
Module ID: `customer`
Mount: `/customers`

## Summary
Customer profiles, tags, lifecycle state, consent fields, and customer events.

## Dependencies
- auth

## Permissions
- customer.read
- customer.write
- customer.admin

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- beforeCustomerCreate
- afterCustomerUpdated

## Events
- customer.created
- customer.updated

## Approval Gate
Risk: medium

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
