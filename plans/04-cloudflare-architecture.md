# Cloudflare Architecture

## Architecture Goal
Use Cloudflare as the managed runtime so users do not need to set up Cloudflare themselves.

The architecture should support:

- agent-driven app generation
- managed deployment
- isolated user apps
- per-project limits
- preview and production environments
- logs and usage
- safe extension hooks
- future BYO Cloudflare mode

## High-Level Components
### Runtime Framework Decision
Use TypeScript + Hono/OpenAPIHono on Cloudflare Workers as the default runtime framework.

Reference pattern: `~/Project/favcrm/v2/api`.

This means:

- Hono route modules for generated app APIs.
- OpenAPIHono where route contracts should be inspectable by agents.
- shared `HonoEnv` types generated from project bindings.
- shared middleware for request IDs, D1/Drizzle, errors, auth, permissions, audit logs, and rate limits.
- `nodejs_compat` only where dependencies require Node.js APIs.
- no Express/Nest-style long-running Node server assumptions.

See `15-hono-cloudflare-runtime-decision.md`.

### 1. Control Plane
Owned by microservices.sh.

Responsibilities:

- users and teams
- billing
- API/MCP keys
- connected accounts
- project registry
- module registry
- template registry
- deployment orchestration
- usage metering
- logs/indexing
- plan limits

### 2. Agent Interface
Used by Claude, Codex, Cursor, or other agents.

Interfaces:

- create package for first local app generation
- project CLI for local/module/deploy control
- remote MCP server after CLI/create parity is credible
- local MCP server for development and client compatibility
- REST API, later

### 3. App Runtime
Each generated app runs as isolated Cloudflare infrastructure.

Use:

- Workers for request runtime
- Hono/OpenAPIHono for HTTP routing
- Workers for Platforms for user/app isolation
- D1 for SQL app data
- Durable Objects for coordination/state
- KV for config/cache
- R2 for files and exports
- Queues/Workflows for async work
- service bindings for internal calls

## Managed Mode
Managed mode is default.

microservices.sh owns:

- Cloudflare account/config
- dispatch namespaces
- user Worker deployment
- D1/KV/R2 provisioning
- secrets binding
- preview URLs
- logs and metering
- plan limits

### Managed Workers Namespace

The MVP managed Workers for Platforms dispatch namespace is:

```text
microservices-sh
```

Generated app Workers should deploy into `microservices-sh` by default.

The dispatch Worker routes hostnames or preview URLs to app Workers inside this namespace. Worker names should be deterministic and should not expose user secrets.

Recommended Worker naming:

```text
app_<project-id>_<environment>
```

Recommended tags:

```text
workspace:<workspace-id>
project:<project-id>
env:<preview|production>
plan:<free|builder|pro|agency>
deployment:<deployment-id>
```

If environment-level isolation becomes necessary later, add suffixed namespaces such as `microservices-sh-preview` and `microservices-sh-production`. The MVP source of truth remains `microservices-sh`.

User owns:

- app requirements
- connected third-party service accounts
- app data export rights
- generated code export, if offered

## BYO Cloudflare Mode
Defer until after paid beta unless required by a high-value customer.

BYO mode should support:

- connect Cloudflare account
- provision resources in user's account
- generate wrangler config
- install module deployments
- transfer runtime cost to user

## Data Model
Start with per-project D1 databases.

Reasons:

- simpler isolation
- easier export/delete
- lower blast radius
- easier plan-based limits
- cleaner debugging

Use shared control-plane database for:

- users
- teams
- projects
- deployments
- billing state
- module versions
- usage records

## Stateful Coordination
Use Durable Objects selectively for:

- booking slot locks
- availability coordination
- realtime admin notifications
- background workflow coordination
- rate-limited connector sync

Do not put all business data in Durable Objects by default. Use D1 for relational records.

## Secrets
Required secret classes:

- microservices.sh platform secrets
- project runtime secrets
- connector secrets
- user-owned third-party API keys

Rules:

- never write secrets into generated source
- never expose secrets to agent transcripts unless explicitly intended
- use scoped tokens for MCP calls
- separate preview and production secrets

Default secret scope:

```text
workspace/<workspace-id>/project/<project-id>/env/<env>/module/<module-id>/<secret-name>
```

Agents may see secret names, scopes, and configured/missing status. They must not see secret values.

Shared secrets are allowed only when explicitly marked shared. Module-private secrets are the default.

## Source Ownership And Deployment

Default source ownership should stay with the user.

Preferred flow:

1. User brings a GitHub repo or microservices.sh creates one for them.
2. Agent installs or updates modules on a branch.
3. microservices.sh opens a PR or produces a patch.
4. Checks run.
5. Managed preview deploy is created in the `microservices-sh` namespace.
6. User reviews and merges.
7. Production deploy requires explicit approval.

Deployment modes:

| Mode | Source Owner | Deployer | MVP Priority |
|------|--------------|----------|--------------|
| Relay deploy | User repo | User GitHub Actions or connected Cloudflare | High |
| Managed preview | User repo or generated artifact | microservices.sh | High |
| Managed production | User repo remains exportable | microservices.sh | Medium |
| BYO Cloudflare | User repo and user Cloudflare | User or microservices.sh relay | Later |

## Usage And Abuse Controls
Required before public deploy:

- per-project CPU/subrequest limits where supported
- deployment quotas
- D1 query/storage tracking
- R2 storage tracking
- outbound fetch allowlist or policy
- project suspension
- user suspension
- billing limit alerts
- logs for abuse review

## Environments
Minimum:

- local
- preview
- production

Preview should be default for agent deploys. Production promotion should require explicit confirmation.

## Open Technical Questions
- Exact Workers for Platforms pricing and limit model for the target scale.
- Whether extension hooks should deploy as separate user Workers or compile into the app Worker.
- Whether each project should get one Worker or multiple service Workers.
- Whether module versions are pinned at app creation or can auto-upgrade with checks.
- How much generated source is stored by microservices.sh versus only in the user's repo.

## Implementation Principle
Prefer a simple runtime first:

- one Hono app Worker
- one D1 database
- one KV namespace
- one R2 bucket only when files are enabled
- extension hooks compiled or bundled in a constrained way

The generated app should compose module routers into one Worker for the MVP. Split into multiple service Workers only when startup size, ownership boundaries, or traffic patterns prove the need.

Add more isolation only when real usage proves the need.
