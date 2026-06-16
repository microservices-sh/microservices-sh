# Authoring Contracts

## Module Must-Haves

- `module.json` with resources, permissions, connections, events, hooks, customization, and approval metadata.
- Framework-neutral `src/index.ts` and folder exports.
- Use cases separated from ports/adapters.
- Schemas for API/config/hooks/events where relevant.
- Migrations and resource declarations.
- Tests and `microservices.check.mjs`.
- `README.md`, `README.agent.md`, and `llms.txt`.

## Template Must-Haves

- `microservices.template.json`, `microservices.config.json`, `microservices.lock.json`.
- Generated project CLI commands and local checks.
- `README.md`, `README.agent.md`, `docs/llms.txt`, `docs/api-boundary.md`.
- Smoke checks and standalone generated-app build path.
- Content schema when agents are expected to edit content.
- Clear source policy: template-owned vs module-owned behavior.

## Status Discipline

- `available`: implemented, tested, documented, and safe to compose.
- `planned`: documented target only; do not market as shipped.
- `deprecated`: still present but not recommended for new plans.

High-risk modules must declare approval gates for migrations, secrets, provider side effects, money movement, permission changes, and production deploys.
