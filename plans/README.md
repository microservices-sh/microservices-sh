# microservices.sh Planning Index

This directory contains the actionable plan for starting the microservices.sh MVP.

## Recommended Reading Order
1. `00-strategy-review.md` - final strategic judgment and positioning.
2. `01-mvp-scope.md` - exact MVP boundary and non-goals.
3. `02-product-validation.md` - how to prove demand before overbuilding.
4. `03-development-roadmap.md` - phased build plan.
5. `04-cloudflare-architecture.md` - managed Cloudflare platform design.
6. `05-agent-interface-and-module-contract.md` - MCP, CLI, and module contract.
7. `06-gtm-promotion.md` - launch and channel plan.
8. `07-success-metrics-pricing.md` - metrics, pricing, and revenue gates.
9. `08-risk-register.md` - risks, mitigations, and kill criteria.
10. `09-interview-script.md` - customer discovery script and scoring.
11. `10-product-proposition-pricing.md` - consolidated proposition, niche, USPs, and pricing comparison.
12. `11-market-research-verification.md` - secondary research verification, confidence levels, and remaining primary research gaps.
13. `12-assumption-validation-results.md` - assumption-by-assumption validation verdicts and required primary tests.
14. `13-mcp-directory-distribution.md` - MCP directory submission plan, readiness gate, positioning, and metrics.
15. `14-landing-page-brand-brief.md` - honeycomb network theme, ICP, conversion brief, and landing page handoff.
16. `15-hono-cloudflare-runtime-decision.md` - Hono/TypeScript on Cloudflare Workers runtime decision based on the FavCRM API reference.
17. `16-cli-sdk-mcp-packaging.md` - CLI, internal SDK, local stdio MCP, Dockerized MCP, and public SDK sequencing.
18. `17-mvp-detailed-execution-plan.md` - detailed MVP scope, stages, modules, architecture, workflow, metrics, gates, and first 30 days.
19. `18-mvp-agent-surface-implementation.md` - implemented local module contract, SDK, CLI, generated booking app, verification, and next engineering slice.
20. `19-module-docs-source-and-permissions.md` - module docs, folder structure, provider module framing, secrets, approval gates, source ownership, deployment modes, and LLM accessibility.
21. `20-cli-first-create-app-strategy.md` - updated activation strategy: create package first, project CLI second, MCP parity after the CLI/create flow is credible.
22. `../docs/templates/template-spec-standard.md` - standard for predefined repo-style templates.
23. `../docs/templates/booking-sveltekit.md` - full Cloudflare SvelteKit booking app template spec and current shell.
24. `21-auth-first-account-and-cli-plan.md` - auth-first implementation plan for user/workspace identity, portal sessions, scoped CLI/API keys, and device login.
25. `22-product-billing-cli-admin-portal.md` - product billing implementation plan for Stripe Checkout, webhooks, admin billing, CLI billing commands, and entitlements.
26. `23-auth-billing-plan-review.md` - consolidated review of auth and billing plans, including blocking issues and remediation order.
27. `24-service-topology-and-auth-comms.md` - service-scoped D1, embedded/service deploy modes, and auth-gated inter-service communication (service bindings + short-lived JWT + signed queue events).
28. `25-module-connection-standard.md` - honeycomb module-connection standard: three primitives (RPC/events/hooks), unified Result envelope, build-time composer, thin runtime dispatch.
29. `26-identity-better-auth.md` - identity layer on Better Auth (user accounts, login, sessions) that bridges to `@microservices-sh/auth` token minting; does not replace the token module. (Draft)
30. `27-market-product-direction-and-mcp-distribution.md` - ICP-focused product direction, distribution posture, MCP packaging, registry, and directory strategy.
31. `managed-deploy-oauth.md` - managed deploy into a user's own Cloudflare account, with API-token-first and OAuth-later sequencing.

## Core Decision
The MVP is good enough to start if it remains narrow:

- Category: agent-native application infrastructure.
- Output: production apps and business systems. SaaS is one possible output.
- Interface: users bring Claude, Codex, Cursor, or another agent.
- Product surface: create package, project CLI, MCP server, module registry, managed Cloudflare deploys, minimal admin UI.
- Activation path: `npm create microservices-app@latest` / `pnpm create microservices-app` first; MCP follows as a parity interface over the same SDK.
- First template: booking/business system with Auth, Customer, Booking, Payment, Email, Admin, and Audit modules.
- Default deployment: managed Cloudflare, so users do not need to set up Cloudflare.
- Backend runtime baseline: TypeScript + Hono/OpenAPIHono on Cloudflare Workers, with Node.js compatibility enabled only where dependencies require it.
- Packaging baseline: create package + project CLI in MVP, internal TypeScript SDK as shared logic, hosted MCP after CLI/create is credible, local stdio MCP soon after, Dockerized MCP after setup friction is proven, public SDK later.
- Pricing frame: sell agent-ready modules, managed deployment, and upgrade safety; do not price as a raw Cloudflare hosting markup.
- Module standard: each module needs a standard folder structure, safe `src/index.ts` entrypoint, OpenAPI route contract, manifest, schemas, hooks, resources, permissions, tests, and LLM-readable docs.
- Third-party services: ship full provider modules such as `payment-stripe`, not thin credential connectors.
- Managed Cloudflare namespace: generated app Workers deploy into the `microservices-sh` Workers for Platforms dispatch namespace for the MVP.
- Trust model: users own source code by default; microservices.sh proposes changes, runs checks, manages previews, and gates production side effects.
- Template model: predefined repo-style templates are allowed after the core module/update flow is stable, but each template must remain module-backed, source-visible, LLM-documented, and upgrade-plan aware.
- Template repo model: official templates live under `templates/*` in this repo for now; each template is self-contained so it can be split or published later.
- Auth-first prerequisite: before billing, implement real user/workspace identity, D1-backed API keys, and secure portal sessions. Static bearer-token auth is only an internal bootstrap.

## Immediate Next Actions
1. Finish the fake-door landing page funnel and waitlist analytics.
2. Use `20-cli-first-create-app-strategy.md` and `18-mvp-agent-surface-implementation.md` as the source of truth for the CLI-first agent workflow.
3. Package the current generator/CLI into a create-app flow before treating MCP as first activation.
4. Recruit 30 customer discovery calls.
5. Start with manual/concierge generation before automating the full platform.
6. Treat current research as secondary validation only; complete primary interviews and paid pilot asks before claiming demand.
7. Use `12-assumption-validation-results.md` as the decision gate before building the managed runtime.
8. Track MCP directory PRs and finish official MCP Registry namespace authentication before treating directory distribution as done.
9. Use `14-landing-page-brand-brief.md` as the design/development brief for the fake-door landing page.
10. Use `15-hono-cloudflare-runtime-decision.md` as the engineering baseline for the runtime scaffold and generated app template.
11. Use `16-cli-sdk-mcp-packaging.md` to sequence create package, CLI, SDK, MCP, local MCP, and Dockerized MCP work.
12. Use `17-mvp-detailed-execution-plan.md` as the build checklist for the MVP.
13. Do not expand beyond the booking template until external users complete the local generation flow.
14. Use `19-module-docs-source-and-permissions.md` and `docs/modules/` as the source of truth for module documentation, structure, and LLM-agent access.
15. Add CLI/MCP doc tools before broadening the public MCP tool surface.
16. Do not treat MCP directories as the first activation path; use them as discovery after the create flow works.
17. Use `docs/templates/template-spec-standard.md`, `docs/templates/booking-sveltekit.md`, and `templates/booking-sveltekit` before extending the first full SvelteKit booking template.
18. Finish the remaining SvelteKit portal API-key management UI before billing.
19. Keep `21-auth-first-account-and-cli-plan.md` as the auth source of truth before product billing, so Stripe subscriptions can attach to trusted workspaces and deploy entitlements.
20. Do not start `22-product-billing-cli-admin-portal.md` implementation until the portal API-key UI is complete and the auth gates remain green.
21. Use `27-market-product-direction-and-mcp-distribution.md` as the current ICP and MCP distribution source of truth.
22. Use `managed-deploy-oauth.md` for the user's-own-Cloudflare deploy path; prove the scoped-token flow before OAuth.
