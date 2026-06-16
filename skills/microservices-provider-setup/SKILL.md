---
name: microservices-provider-setup
description: Plan and configure external provider integrations in microservices.sh apps. Use for Stripe/payment, subscriptions, email providers, webhook delivery, Google Calendar, R2 files/media, image generation providers, ads connectors, secrets, callbacks, and provider smoke tests.
---

# microservices.sh Provider Setup

Use this skill for provider-backed modules and external side effects. Provider work is plan-first, local-first, and approval-gated.

## Provider Workflow

1. Identify the provider surface and owning module. Read `references/provider-map.md`, then read the local module docs and manifest.
2. Inventory required bindings, secrets, callback URLs, webhook endpoints, scopes, and provider dashboard changes.
3. Create a plan before editing. Include local config, secret names, migration/resource changes, test mode, and rollback.
4. Implement only non-secret source/config changes directly. Do not request secret values in chat.
5. Verify locally or in provider test mode before any production side effect.
6. Ask for explicit approval before confirm commands, remote resource changes, webhook activation, email sending, money movement, ad account changes, or production deploys.

## Approval Gates

Require explicit approval before:

- Configuring or rotating secrets.
- Sending real email, charging/refunding money, syncing real calendars, calling ad APIs, or generating billable provider usage.
- Activating external webhook endpoints or exposing callback URLs.
- Applying remote D1/R2/Queue resources, migrations, preview deploys, or production deploys.
- Deleting provider data, objects, accounts, subscriptions, webhooks, or keys.

## Output Contract

Return:

- Provider and owning module.
- Required secrets/bindings and where the user should configure them.
- Source files to change.
- Local/test-mode verification.
- Provider dashboard steps the user must perform.
- Explicit list of production actions not executed.
