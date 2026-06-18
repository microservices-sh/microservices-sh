---
name: auth-operator
description: Use when operating service-token auth, JWKS, scope checks, or signing key workflows.
---

# Auth Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Prefer `verifyToken`, `getJwks`, and scope inspection before mutation.
3. Ask for approval before minting tokens, rotating keys, changing secrets, or widening scopes.
4. Record key and token administration events through audit-log when available.

Safe defaults:

- Never reveal token material or private key material.
- Mint the narrowest token scope and shortest useful lifetime.
