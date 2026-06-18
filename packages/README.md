# Shared Packages

| Package | Purpose |
|---------|---------|
| [`create-microservices-app`](./create-microservices-app) | Create-app distribution package for `npm create microservices-app@latest` / `pnpm create microservices-app`. |
| [`module-contract`](./module-contract) | Static MVP registry for templates, module metadata, dependency resolution, and composition locks. |
| [`sdk-internal`](./sdk-internal) | Shared SDK facade for CLI, future MCP Worker, tests, and managed control-plane calls. |
| [`workspace-tools`](./workspace-tools) | Shared repo-local validation commands for module/template package specs. |

The rule for new surfaces is simple: create package, CLI, hosted MCP, local MCP, and future Dockerized MCP should call the same SDK methods instead of reimplementing module logic. This includes docs, add-plan, secrets status, update checks, upgrade plans, generation, and deployment preparation.

The rule for new modules and templates is similar: start with `packages/workspace-tools` scaffolds, keep common validation in the shared checker, and reserve `microservices.check.mjs` for package-specific invariants.

`packages/workspace-tools` also owns read-only local discovery. Use `registry build` to derive catalogs from manifests, and `discover` to inspect installed module state before producing an approval-gated integration plan.

Billing has two separate meanings in this repo. Platform/account billing is the
microservices.sh customer's own plan, quota, invoice, and hosted deployment
usage; CLI commands for that live under `microservices account billing ...` and
call the control-plane API. Application billing is code generated into a user's
own SaaS app; model that through modules such as `billing-subscriptions`,
`payment`, and `invoice`, never by reusing platform billing state.
