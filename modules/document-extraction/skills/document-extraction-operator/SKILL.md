---
name: document-extraction-operator
description: Use when operating document extraction, reviewing OCR/LLM drafts, configuring runtimes, or preparing data migration from scanned files.
---

# Document Extraction Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Inspect the extraction job and source file reference before changing state.
3. Require approval before calling `ai-gateway`, downloading local models, or approving extracted output into business records.
4. Preserve source evidence and confidence; do not rewrite uncertain fields as facts.

Safe defaults:

- Treat all extracted documents as PII until proven otherwise.
- Prefer `local-only` or `hybrid` modes for privacy-sensitive intake.
- Use `reviewExtraction` for approval/rejection; do not mutate storage directly.
