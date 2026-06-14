# Hono Cloudflare Runtime Decision

Generated: 2026-06-13

## Decision
Use the same broad backend pattern as `~/Project/favcrm/v2/api`:

> TypeScript + Hono on Cloudflare Workers, with `nodejs_compat` enabled where needed.

Use this wording internally and externally:

> Hono on Cloudflare Workers with Node.js compatibility.

Avoid saying:

> Node.js server on Cloudflare.

Reason: Cloudflare Workers is not a normal long-running Node.js server. It is a Workers runtime that supports many Node.js APIs through compatibility flags. This distinction matters because generated modules must follow Workers constraints around bindings, request lifecycle, background work, global state, streams, and deployment config.

## Why This Fits microservices.sh
Hono is a good default for microservices.sh because it gives us:

- small, readable route modules that AI coding agents can inspect and modify
- Workers-native request handling
- TypeScript-first module boundaries
- middleware composition for auth, tenant, permissions, audit, and rate limits
- OpenAPI generation through `@hono/zod-openapi`
- compatibility with Cloudflare bindings such as D1, KV, R2, Queues, Durable Objects, service bindings, and Workers for Platforms
- a proven internal reference from FavCRM

This is a better MVP fit than Express, NestJS, or a custom router because agents will need to copy, inspect, compose, and safely patch generated route modules.

## FavCRM Reference Patterns
The useful patterns from `~/Project/favcrm/v2/api` are:

| Pattern | FavCRM Example | microservices.sh Adaptation |
|---------|----------------|-----------------------------|
| Hono route composition | `workers/customer/src/index.ts`, `workers/merchant/src/index.ts`, `workers/aux/src/index.ts` | Generated apps compose module routers into one app Worker |
| OpenAPIHono | `new OpenAPIHono<HonoEnv>()` | Every API module can export routes and optional OpenAPI metadata |
| Shared typed env | `packages/shared/src/types.ts` | Generate `HonoEnv` from module bindings and app config |
| D1 middleware | `packages/shared/src/middleware/db.ts` | Default DB middleware wraps Drizzle/D1 for app modules |
| Error handler | `packages/shared/src/middleware/error-handler.ts` | Standard JSON error contract for all generated modules |
| Request ID | `hono/request-id` | Required for logs, audit events, and agent-debuggable failures |
| Audit middleware | `packages/shared/src/middleware/audit.ts` | First-class audit module and generated `auditable()` wrappers |
| Split Workers by surface | customer, merchant, aux, mcp, background | Platform control plane, MCP server, generated app runtime, background worker |
| Background worker | `workers/background/src/index.ts` | Queues, cron, email, and long-running jobs stay off request paths |
| Dedicated MCP worker | `workers/mcp/src/index.ts` | MCP remains a separate product surface from generated app APIs |
| Wrangler config per Worker | `workers/*/wrangler.toml` | Each platform Worker and generated app gets explicit bindings |
| `nodejs_compat` flag | `compatibility_flags = ["nodejs_compat"]` | Enable only where dependencies require Node.js APIs |
| Observability | `[observability] enabled = true` | Required for generated previews and managed deploys |

## Recommended Repository Shape
For the microservices.sh MVP, use a pnpm monorepo similar in spirit to FavCRM:

```text
apps/
  control-plane/
    src/index.ts
    wrangler.jsonc
  mcp/
    src/index.ts
    wrangler.jsonc
  background/
    src/index.ts
    wrangler.jsonc
packages/
  runtime/
    src/create-app.ts
    src/middleware/error-handler.ts
    src/middleware/request-id.ts
    src/middleware/audit.ts
    src/middleware/db.ts
  modules/
    auth/
    customer/
    booking/
    payment/
    email/
    admin/
    audit-log/
  module-contract/
    src/module.schema.ts
  db/
    src/schema/
  templates/
    booking-business/
generated/
  examples/
```

Use `wrangler.jsonc` for new code unless there is a strong reason to use TOML. JSONC is easier for agents to patch and validate against schema, while FavCRM's TOML files remain useful as reference examples.

## Runtime Surfaces
### 1. Control Plane Worker
Owns microservices.sh account and project APIs:

- users
- teams
- billing
- API/MCP keys
- project registry
- module registry
- template registry
- deploy orchestration
- usage records
- logs metadata

Use Hono/OpenAPIHono.

### 2. MCP Worker
Owns agent-facing tools:

- `/mcp`
- `/.well-known/mcp/*`
- `/api/agent/*` if needed
- OAuth/token exchange if needed
- tool calls such as `list_modules`, `compose_app`, `generate_project`, `deploy_preview`

Keep broad execution tools out of the public MCP surface. Do not expose `run_shell` or arbitrary code execution.

### 3. Generated App Worker
Owns the generated app API and optional static assets:

- one Worker per generated app for MVP
- module routers composed into one Hono app
- per-project D1 binding
- KV for config/cache/rate-limit state
- R2 only when file modules are enabled
- Queues for async jobs
- Durable Objects only for coordination that needs strict state

This keeps the MVP simpler than making every module an individual Worker.

### 4. Background Worker
Owns work that should not block HTTP requests:

- queues
- cron triggers
- webhook retries
- email send jobs
- payment reconciliation
- module upgrade checks
- audit export jobs

Use plain Workers handlers for `queue`, `scheduled`, and `email`. Hono is only needed when the Worker has HTTP routes.

## Generated App Hono Shape
Generated app entrypoint should look like this conceptually:

```ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";
import type { HonoEnv } from "./runtime/env";
import { dbMiddleware } from "./runtime/middleware/db";
import { errorHandler } from "./runtime/middleware/error-handler";
import { auditMiddleware } from "./runtime/middleware/audit";
import { authRoutes } from "./modules/auth/routes";
import { customerRoutes } from "./modules/customer/routes";
import { bookingRoutes } from "./modules/booking/routes";

const app = new OpenAPIHono<HonoEnv>().basePath("/api");

app.use("*", requestId());
app.use("*", dbMiddleware);
app.onError(errorHandler);

app.route("/auth", authRoutes);
app.route("/customers", customerRoutes);

const bookingApp = new OpenAPIHono<HonoEnv>();
bookingApp.use("*", auditMiddleware("booking"));
bookingApp.route("/", bookingRoutes);
app.route("/bookings", bookingApp);

export default app;
```

The actual generated code should be deterministic and boring. Agents should be able to see exactly where a module is mounted, what middleware applies, and what bindings are required.

## Module Runtime Contract Update
Each module should export:

- Hono router or OpenAPIHono router
- route mount metadata
- required bindings
- required environment variables
- D1 schema fragments
- migrations
- permissions
- emitted events
- consumed events
- queue producers or consumers
- cron requirements, if any
- Durable Object requirements, if any
- middleware requirements
- audit resources
- tests
- `README.agent.md`

Example:

```ts
export const bookingModule = defineModule({
  name: "booking",
  version: "0.1.0",
  routes: [{ mount: "/bookings", router: bookingRoutes }],
  bindings: ["DB", "CACHE_KV", "NOTIFICATIONS"],
  audit: ["booking"],
  eventsEmitted: ["booking.created", "booking.cancelled"],
  hooks: ["beforeBookingCreate", "calculateAvailability", "afterBookingConfirmed"],
});
```

## Node.js Compatibility Policy
Use `nodejs_compat` pragmatically, not as permission to write Node server code.

Rules:

- Prefer Web APIs and Workers-native bindings.
- Enable `nodejs_compat` when dependencies need supported Node.js APIs.
- Do not use filesystem-dependent libraries for runtime behavior.
- Do not assume long-lived process state.
- Do not use Node HTTP servers, Express listeners, or port binding.
- Do not store request-scoped data in module-level variables.
- Use `ctx.waitUntil()` for post-response work.
- Use Queues/Workflows for durable async work.

Cloudflare currently documents `nodejs_compat` as the compatibility flag for built-in Node.js APIs and polyfills, with compatibility date requirements. Re-check the docs before implementation because this area changes.

## Best-Practice Defaults
New Workers should default to:

- TypeScript
- Hono or OpenAPIHono for HTTP routes
- generated `Env`/binding types
- current compatibility date at project creation
- `nodejs_compat` only when needed by dependencies
- `observability.enabled = true`
- structured JSON errors
- request IDs
- D1 through Drizzle
- Queues for non-trivial async jobs
- service bindings for Worker-to-Worker calls
- no hardcoded secrets
- no raw Cloudflare REST API calls from inside a Worker when bindings exist

## What This Changes In The MVP
The MVP should now explicitly include a runtime scaffold before module automation:

1. Create Hono Workers monorepo scaffold.
2. Build shared runtime package with env types, response helpers, request ID, error handler, DB middleware, audit middleware, and hook runner.
3. Build the booking template as composed Hono module routers.
4. Generate OpenAPI for the composed app.
5. Deploy preview to managed Cloudflare.
6. Use the same runtime shape for the MCP server and control plane, with separate Workers.

## Risks
| Risk | Mitigation |
|------|------------|
| Agents write normal Node.js server code | Provide strict generated examples and tests that fail on Express/listen/fs patterns |
| Module routers become too coupled | Keep module route exports and service logic separate |
| Large composed app hits startup or bundle limits | Split surfaces only after the MVP proves the need |
| `nodejs_compat` hides incompatible dependencies until runtime | Add deploy-time compatibility checks and Workers-runtime tests |
| OpenAPI generation leaks internal routes | Use explicit public path allowlists like FavCRM does |

## Sources Checked
- Local reference: `~/Project/favcrm/v2/api`
- Cloudflare Hono framework guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/
- Cloudflare Node.js compatibility docs: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Hono Cloudflare Workers guide: https://hono.dev/docs/getting-started/cloudflare-workers

## Final Recommendation
Adopt the FavCRM-style Hono Workers architecture as the microservices.sh MVP runtime baseline.

The key adaptation is that microservices.sh modules are not just route files. They are **agent-readable, versioned Hono module packages** with routes, schemas, bindings, migrations, hooks, tests, audit metadata, and upgrade metadata.
