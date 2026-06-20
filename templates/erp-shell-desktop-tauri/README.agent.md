# ERP Shell Desktop Tauri Agent Guide

Use this template as a desktop companion for `erp-shell-sveltekit`.

Safe first actions:

1. Read `microservices.template.json`.
2. Read `microservices.lock.json`.
3. Read `docs/llms.txt`.
4. Run `pnpm check:spec`.
5. Run `pnpm microservices check --json`.

Boundaries:

- Keep production business records in the generated ERP Shell backend.
- Keep desktop state limited to local draft import/extraction state until sync is approved.
- Do not add provider calls, local model downloads, filesystem writes outside app-owned directories, or sync mutations without approval.
- Rust owns desktop/file/process capabilities; Svelte owns the UI.
- Module domain behavior belongs in modules, not in the desktop template.

Desktop targets:

- macOS Apple Silicon first.
- Windows x64 first.
- macOS Intel and Windows ARM after demand is proven.
