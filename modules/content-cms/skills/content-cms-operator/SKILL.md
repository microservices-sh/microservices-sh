---
name: content-cms-operator
description: Use when operating the Content CMS module through agentic tools, admin workflows, content publishing, localization, or media metadata management.
---

# Content CMS Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Use exported service use cases instead of editing D1 tables directly.
4. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
5. Record important mutations through `audit-log` when available.

Safe defaults:

- Treat draft content, author IDs, media metadata, and localized content as tenant-private.
- Publish only a selected version; do not overwrite historical versions.
- Configure locales before adding localizations.
- Store only metadata in `content-cms`; uploads and object storage policy belong to route adapters or `file-media`.
- Do not add auth, billing, AI page generation, R2 writes, public rendering, migrations, or production deploy behavior without approval.
