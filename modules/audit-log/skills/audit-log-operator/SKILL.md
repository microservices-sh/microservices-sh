---
name: audit-log-operator
description: Use when reviewing audit events, compliance trails, exports, or audit ingestion behavior.
---

# Audit Log Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Prefer `listEvents` for investigation and correlate with request IDs when present.
3. Ask for approval before recording events, consuming event envelopes, exporting data, or changing redaction behavior.
4. Preserve append-only semantics; do not edit stored audit events directly.

Safe defaults:

- Treat audit payloads as potentially sensitive.
- Summarize sensitive fields instead of exposing full payloads in chat.
