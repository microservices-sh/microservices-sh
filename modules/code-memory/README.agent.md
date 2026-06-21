# Code Memory Module Agent Guide

Use this module through `@microservices-sh/code-memory`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm test` after source edits.

Mutation rules:

- Add Trusted Sources only after the user approves the repo and allowed paths.
- Do not execute source repository code during scan.
- Search only approved Logic Capsules by default.
- Preserve provenance, constraints, tests, and required environment variables in retrieval results.
- Do not apply code to a workspace from this module; apply workflows belong in CLI/MCP orchestration with explicit approval.
