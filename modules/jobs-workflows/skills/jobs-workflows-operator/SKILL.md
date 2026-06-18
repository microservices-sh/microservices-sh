---
name: jobs-workflows-operator
description: Use when triaging background jobs, schedules, retries, dead-letter records, or workflow execution.
---

# Jobs & Workflows Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Inspect job state, attempts, schedule windows, and dead-letter context before mutation.
3. Ask for approval before enqueueing jobs, running jobs, retrying dead jobs, or updating schedules.
4. Record operational changes through audit-log when available.

Safe defaults:

- Assume jobs may trigger external side effects.
- Prefer dry-run analysis or listing due work before execution.
