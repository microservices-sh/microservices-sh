---
name: image-generation-operator
description: Use when operating image generation, editing, gallery review, provider fallback, or generated asset deletion.
---

# Image Generation Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Check tenant, provider configuration, and generation history before creating or editing.
3. Ask for approval before generating, editing, deleting images, or changing provider settings.
4. Record moderation or deletion events through audit-log when available.

Safe defaults:

- Treat prompts, source images, and generated files as tenant data.
- Do not generate paid/provider-backed assets without approval.
