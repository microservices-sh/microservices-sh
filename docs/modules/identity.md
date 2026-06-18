# Identity

Status: available
Module ID: `identity`
Mount: `/identity`

## Summary
Passwordless email-code login and server-side sessions, built on `@microservices-sh/auth`.

`identity` is the human-login layer for the trust boundary workflow. It owns accounts,
login codes, and sessions, then bridges an authenticated user session to short-lived
scoped service tokens minted by `auth`.

## Dependencies
- auth

Optional:

- email
- audit-log

## Permissions
- identity.login
- identity.session
- identity.admin
- identity.extend
- identity.observe

## Secrets
No direct provider secrets are required by the module manifest.

If email delivery is enabled through the optional `email` module, provider secrets are
owned by `email`, not by `identity`.

## Resources
- D1 tables: `accounts`, `login_codes`, `sessions`

## RPC
- `requestLoginCode` (`identity.login`)
- `verifyLoginCode` (`identity.login`)
- `readSession` (`identity.session`)
- `destroySession` (`identity.session`)

## Hooks
- beforeVerifyCode
- afterSessionCreated

## Events
- identity.login_code_issued
- identity.login_verified
- identity.session_created
- identity.session_destroyed

## Security Invariants
- Login codes are never stored in plaintext.
- Code comparisons must stay timing-safe.
- Service tokens must be minted through `auth`; do not sign service tokens locally.
- Session cookies should stay HTTP-only, secure in production, and same-site scoped.
- Login code expiry, single-use behavior, and session invalidation are part of the auth boundary.

## Approval Gate
Risk: high

Adding or changing auth, session-token, email, migration, PII, or production deploy behavior requires explicit approval.

## Agent Checklist
1. Read `module.json` before modifying login/session behavior.
2. Keep login-code hashing and timing-safe comparison intact.
3. Use `auth` for service-token minting.
4. Prefer hooks for policy changes before editing module internals.
5. Verify session destruction and expired-code behavior after changes.
6. Do not print login codes, session tokens, service tokens, or secret values in logs.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
