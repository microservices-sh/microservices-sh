---
name: code-memory-operator
description: Use when managing Trusted Sources, Logic Capsules, approvals, provenance, or agent code-reuse retrieval.
metadata:
  version: 0.1.0
---

# Code Memory Operator

Use this skill to manage Code Memory state safely.

Rules:

1. Confirm the workspace, repo URL, allowed paths, and visibility before adding a Trusted Source.
2. Do not execute untrusted repository code while scanning.
3. Review candidate Logic Capsules before approval.
4. Preserve provenance, tests, dependencies, required env, constraints, and do-not-use notes.
5. Retrieval should prefer approved capsules; candidates require explicit review.
6. Do not apply code changes from memory without an explicit user request and a verification plan.
