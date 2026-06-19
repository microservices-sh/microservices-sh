---
name: passkey-operator
description: Use when operating the Passkey Auth module through agentic tools, admin workflows, or login-support triage.
---

# Passkey Auth Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection (`listCredentials`) before mutation.
3. Ask for explicit approval before `deleteCredential` (listed in `surfaces.agentic.approvalRequiredFor`).
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat credential metadata as sensitive.
- Never weaken the signature-counter replay check.
- Remember: this module returns a verified `userId` on authentication — it does NOT
  mint sessions. Session creation is the host app's responsibility.
- Use module use-cases instead of editing storage directly.
