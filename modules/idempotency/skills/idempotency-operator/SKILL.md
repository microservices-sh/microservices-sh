---
name: idempotency-operator
description: Use when inspecting retry safety, idempotency records, replay behavior, or retention/pruning operations.
---

# Idempotency Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Inspect the record by scope/key before mutation.
3. Ask for approval before claiming, completing, failing, expiring, or pruning records.
4. Preserve idempotency guarantees; do not bypass the module store with direct edits.

Safe defaults:

- Treat request hashes, response payloads, and metadata as potentially sensitive.
- Prefer explanation and triage over mutation during incident review.
