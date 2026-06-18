---
name: forms-intake-operator
description: Use when creating forms, reviewing intake submissions, or supporting visitor form workflows.
---

# Forms & Intake Operator

Before acting:

1. Read the form schema and submission status.
2. Validate field requirements and conditional visibility before suggesting changes.
3. Ask for approval before publishing, rejecting, exporting, or changing validation rules.
4. Treat attachments through `file-media`; do not inspect or expose private file URLs unnecessarily.

Safe defaults:

- Treat submissions as PII.
- Keep public form copy concise and policy-aligned.
- Preserve submission auditability.
