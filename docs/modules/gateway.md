# Gateway

Status: available
Module ID: `gateway`
Mount: `/gateway`

## Summary
Public trust boundary: API-key authentication, rate limiting, scope narrowing, and token exchange via auth.

## Dependencies
- auth

## Permissions
- gateway.admin

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1
- KV

## Hooks
- beforeIssueToken
- afterTokenIssued

## Events
- gateway.token_issued
- gateway.access_denied

## Approval Gate
Risk: high

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
