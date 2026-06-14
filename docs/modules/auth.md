# Auth

Status: available
Module ID: `auth`
Mount: `/auth`

## Summary
EdDSA service-token mint/verify, scope checks, and JWKS for auth-gated inter-service communication.

## Dependencies
- none

## Permissions
- auth.mint
- auth.verify
- auth.admin

## Secrets
- AUTH_SIGNING_KEY

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- beforeMintToken
- afterTokenMinted

## Events
- auth.token_minted
- auth.key_rotated

## Approval Gate
Risk: high

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
