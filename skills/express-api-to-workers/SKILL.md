---
name: express-api-to-workers
description: Migrate an Express/Node.js API to Cloudflare Workers inside a microservices.sh app. Use when a user has an existing Express (or Fastify/Koa/Nest) HTTP API and wants to move routes, middleware, and handlers onto the Workers runtime behind microservices.sh module boundaries. Covers runtime gap assessment, route/middleware translation, data and integration cutover, and verification.
---

# Express / Node API → Cloudflare Workers

## Overview

Use this skill to move an existing Node HTTP API onto the Cloudflare Workers runtime inside a microservices.sh app. The target keeps route handlers thin and pushes domain logic into modules and documented use-case files, with provider details behind adapters/ports.

The hard part is not routing — it is the **runtime gap**: Workers is not Node. No persistent process, no filesystem, no long-lived in-memory state, a request-scoped execution model, and Web-standard APIs instead of Node built-ins. Map those before porting handlers.

This is plan-first and approval-gated. Cutting over an API touches live traffic, data, and integrations — never apply remote changes without explicit approval.

## Runtime Gap Mapping

| Express / Node | Workers target | Notes |
| --- | --- | --- |
| Long-lived process + in-memory cache | Stateless per request; state in KV/D1/DO | No module-scope mutable state across requests |
| `fs` / local disk | R2 (objects), KV (small values) | No filesystem |
| `process.env` | Worker bindings + secrets | Set via wrangler/secrets, not `.env` at runtime |
| Express middleware chain | Worker handler composition / module hooks | Re-express auth, logging, validation as composable steps |
| `req`/`res` (Node) | `Request`/`Response` (Web Fetch) | Streams and bodies are Web-standard |
| `setInterval`/background timers | Cron Triggers / Queues / `waitUntil` | No free-running timers |
| WebSocket server (`ws`) | Durable Objects + WebSocket | `durable-objects` skill |
| Node DB drivers (`pg`, `mysql2`) | D1 / Drizzle, or HTTP-based driver | Native TCP drivers do not run on Workers |
| `Buffer`, `crypto` (Node) | Web `crypto`, `Uint8Array` | Some Node APIs available via nodejs_compat; prefer Web APIs |
| Heavy CPU per request | Watch CPU limits; offload to Queues | |

Flag every handler that relies on persistent process state, the filesystem, native DB drivers, or long-running work — these are the real port cost, not the route table.

## Workflow

### 1. Assess the source

- List routes (method + path), grouped by domain/resource.
- Inventory middleware: auth, validation, rate limiting, logging, CORS, body parsing.
- Find runtime-gap usages: `fs`, native DB drivers, background timers, in-memory caches/sessions, WebSocket servers, large dependencies.
- Note external integrations (payment, email, third-party APIs) and which map to existing modules.

### 2. Scaffold or target the app

```bash
pnpm create microservices-app@latest <app-name> --template <template-id>
cd <app-name>
pnpm install
pnpm microservices local setup
```

Map resources to existing modules first:

```bash
pnpm microservices modules list --json
```

- Routes over people/accounts → `customer`.
- Payment endpoints → `payment-stripe`.
- Mail-sending endpoints → `email`.
- Build remaining surfaces as overlays/use-case files, not by forking module internals.

### 3. Translate routes and middleware

- Re-express each route as a thin Worker handler delegating to a module/use-case function.
- Convert middleware to composable steps or module hooks: auth at the Worker boundary, validation in use-cases, logging via the platform's mechanism.
- Replace `req`/`res` with Web `Request`/`Response`; adapt body parsing and streaming to Web standards.
- Keep `docs/api-boundary.md` accurate as routes/adapters change.

### 4. Move data and integrations

- Move the datastore with `prisma-postgres-to-d1` (or the Supabase/Firebase skill) if the API owns its DB.
- Replace native DB drivers with D1/Drizzle or HTTP-based drivers.
- Route third-party calls through module adapters/ports; put keys in secrets, not code.
- Re-implement sessions/caches on KV or D1; move background work to Cron Triggers or Queues.

### 5. Verify

```bash
pnpm dev
pnpm microservices local smoke
pnpm microservices check --json
```

Verify each migrated route returns equivalent responses, auth/validation behave as before, and no handler depends on removed Node primitives. Only after local verification, plan the approval-gated remote deploy and cutover.

## Approval Gates

Ask for explicit approval before:

- Cutting over live API traffic or changing public endpoints/contracts.
- Importing data into remote D1 or any production resource.
- Provisioning Cloudflare resources, secrets, Queues, or deploying.
- Decommissioning the source API (confirm rollback path first).

Never ask the user to paste secret values into chat. Discuss names, scopes, and where to set them.

## Finish Checklist

Report:

- Routes/middleware ported and which relied on removed Node primitives.
- Integrations mapped to modules vs rebuilt as overlays.
- Data-layer move (which skill, verified counts) if applicable.
- Approval-gated work planned but not executed (traffic cutover, remote import, deploy, source teardown).
