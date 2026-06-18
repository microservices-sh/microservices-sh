---
name: identity-operator
description: Use when supporting passwordless login, sessions, account access, or visitor authentication flows.
---

# Identity Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Verify the user, tenant, and support context before account or session actions.
3. Ask for approval before requesting login codes, verifying codes, destroying sessions, or changing auth-sensitive configuration.
4. Record sensitive account support actions through audit-log when available.

Safe defaults:

- Never ask for or reveal login codes in chat.
- Do not impersonate users or create sessions without explicit approval.
