---
name: video-generation-operator
description: Use when operating the Video Generation module through agentic tools, admin workflows, async generation jobs, provider status reconciliation, or generated video output records.
---

# Video Generation Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Use exported service use cases instead of editing D1 tables directly.
4. Ask for explicit approval before provider submit, provider poll/webhook reconciliation, asset download/finalization, migrations, or production deploy.
5. Record important mutations through `audit-log` when available.

Safe defaults:

- Treat prompts, references, provider task ids, and outputs as tenant-private.
- Do not call a provider unless the host supplied an approved `VideoGenerationProvider`.
- Do not charge credits, refund, rate-limit, moderate, send email, or download bytes inside this module.
- Attach output metadata only after a route adapter or companion module has finalized storage.
