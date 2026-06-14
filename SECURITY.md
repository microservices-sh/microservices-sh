# Security Policy

microservices.sh generates and deploys application foundations. Security issues can affect generated apps, provider integrations, secrets, Cloudflare resources, and deployment workflows.

## Reporting

Do not open public issues for vulnerabilities.

For now, report privately to the maintainers of the `microservices-sh` organization. Before public launch, this repo should enable GitHub private vulnerability reporting or publish a dedicated security contact.

Include:

- affected package, module, template, CLI command, MCP tool, or API route
- reproduction steps
- impact
- whether secrets, PII, payments, webhooks, migrations, or deployments are involved
- suggested fix if known

## Scope

Security-sensitive areas include:

- auth and session behavior
- secret names, storage, display, and redaction
- provider modules such as payment, email, analytics, CRM, and storage
- webhooks and signature verification
- D1/KV/R2/Queue resources and bindings
- generated migrations
- CLI/MCP/API commands that mutate source, resources, deployments, or production state
- GitHub Actions release and deploy workflows

## Rules For Contributors

- Never commit real secrets, tokens, private keys, customer data, or provider credentials.
- Never print secret values in CLI, MCP, logs, docs, tests, or generated output.
- Do not make module imports perform network calls, create resources, apply migrations, send email, create payments, or mutate external state.
- Keep production actions behind explicit confirmations.
- Keep provider modules least-privilege by default.
- Add tests for webhook verification, permission gates, migration behavior, and failure handling when relevant.

## Dependency And Supply Chain

The create package is the public activation path, so published artifacts must be reproducible and minimal. The package currently bundles the generator and should not publish runtime workspace dependencies.

Before public release:

- choose a public license
- enable npm provenance
- require CI for `main`
- protect release workflows
- enable secret scanning and Dependabot/security updates where available
- require review for workflow changes
