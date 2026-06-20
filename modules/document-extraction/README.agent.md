# Document Extraction Module Agent Guide

Use this module through `@microservices-sh/document-extraction`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Do not add provider calls, model downloads, secrets, migrations, or production deploy behavior without approval.

Boundary:

- `document-extraction` owns extraction jobs, drafts, review decisions, and approved output.
- `ai-gateway` owns governed Gemma/provider calls.
- Browser/sidecar runtimes are adapters; do not bake model install into this module.
