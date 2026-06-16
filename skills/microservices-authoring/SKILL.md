---
name: microservices-authoring
description: Create or update microservices.sh modules and templates. Use when authoring module.json, microservices.template.json, schemas, migrations, hooks, events, permissions, README.agent.md, llms.txt, generated project commands, smoke checks, or registry/catalog contributions.
---

# microservices.sh Authoring

Use this skill when changing the reusable product surface: modules, templates, contracts, registries, scaffolds, checks, and generated project behavior.

## Choose The Artifact

- Module: owns domain behavior, schemas, use cases, ports, adapters, resources, permissions, events, hooks, docs, and migrations.
- Template: composes modules into a generated app with app shell, routes, layout, UI overlays, content, project CLI commands, smoke checks, and source ownership rules.
- Registry/catalog: derived discovery layer; rebuild rather than hand-maintain when tooling exists.

Read `references/authoring-contracts.md`, then use the repo docs:

- `docs/modules/module-spec-standard.md`
- `docs/modules/module-package-structure.md`
- `docs/templates/template-spec-standard.md`
- `docs/templates/content-contracts.md`
- `docs/governance/module-submission-guide.md`

## Module Workflow

1. Start with `pnpm scaffold:module -- <module-id>` unless editing an existing module.
2. Define `module.json`: status, class, resources, permissions, connections, events, hooks, customization, and approval gates.
3. Implement framework-neutral use cases first; put provider details behind ports/adapters.
4. Add schemas, migrations, tests, `README.md`, `README.agent.md`, `llms.txt`, and `microservices.check.mjs`.
5. Keep high-risk provider effects approval-gated.
6. Run module tests and workspace contract checks.

## Template Workflow

1. Start with `pnpm scaffold:template -- <template-id> --framework <framework> --modules <ids>` unless editing an existing template.
2. Define `microservices.template.json`, `microservices.config.json`, `microservices.lock.json`, generated project commands, and source ownership.
3. Add docs: `README.md`, `README.agent.md`, `docs/llms.txt`, `docs/api-boundary.md`, and optional content schema.
4. Keep generated output standalone: no hidden dependency on another template folder.
5. Add smoke checks and `microservices.check.mjs`.
6. Run create-package smoke or template-specific build/check when affected.

## Acceptance Checks

Use the narrowest relevant set:

```bash
pnpm spec:check -- all
pnpm registry:build -- --json
pnpm --filter create-microservices-app smoke
pnpm test
```

Report generated artifacts or registry outputs separately from source edits.
