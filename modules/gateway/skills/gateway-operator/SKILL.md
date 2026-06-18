---
name: gateway-operator
description: Use when managing API keys, rate limits, gateway token exchange, or public API boundary support.
---

# Gateway Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Verify requested scopes and caller intent before any key or token action.
3. Ask for approval before creating API keys, issuing tokens, changing public exposure, or modifying rate limits.
4. Record key administration through audit-log when available.

Safe defaults:

- Do not reveal raw API keys or bearer tokens.
- Prefer least-privilege scopes and short lifetimes.
