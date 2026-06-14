# CLI-First Create App Strategy

Generated: 2026-06-13

## Decision
The MVP activation path should start like a familiar developer tool:

```bash
npm create microservices-app@latest booking-demo
cd booking-demo
npm run dev
```

or:

```bash
pnpm create microservices-app booking-demo
cd booking-demo
pnpm dev
```

The hosted MCP server, local MCP package, and Dockerized MCP package should remain important agent surfaces, but they should not be the first setup dependency. The first experience should prove that an agent and developer can create a working local app from verified modules in minutes.

## Why This Is Better For MVP Validation
CLI-first removes the largest early friction:

- no MCP client configuration before value is visible
- no Cloudflare setup before local app inspection
- no token or account setup for the first generated app
- familiar mental model for developers who know `create-react-app`, `create-vite`, and framework starters
- easier for Codex, Claude, Cursor, CI, and humans to run
- easier to record demos, write docs, and debug support issues

MCP directories still matter for discovery, but the directory visitor should land on a quickstart that begins with the create command and then offers MCP as an agent integration layer.

## Product Proposition After This Change
microservices.sh is:

> A CLI-first, agent-native module system for generating, customizing, and deploying Cloudflare-native production app foundations.

Short form:

> Start with `pnpm create microservices-app`, then let your agent inspect, add, customize, check, and deploy verified modules.

Do not position the product as:

- only an MCP server
- only a SaaS builder
- a generic boilerplate
- a Cloudflare hosting wrapper
- a no-code app builder

## Access Surface Priorities
| Surface | MVP Priority | Role |
|---------|--------------|------|
| Create package | P0 | First activation and demo path. |
| Project CLI | P0 | Agent-friendly commands inside generated apps. |
| Internal SDK | P0 | Shared implementation for create package, CLI, MCP, tests, and future API. |
| Hosted MCP | P0.5 | Agent-native parity surface after CLI/create flow is credible. |
| Local stdio MCP | P1 | Compatibility for clients that prefer local subprocess MCP. |
| Dockerized MCP | P1.5 | Reproducible enterprise/devcontainer setup after demand is proven. |
| Public SDK | P2 | Defer until contracts stabilize. |

## Package Responsibilities
### `create-microservices-app`
One-time project creation.

Responsibilities:

- select template
- create project directory
- write generated app files
- write `microservices.lock.json`
- install or suggest install command
- print next commands
- work without login for local generation
- optionally accept `--template`, `--package-manager`, `--no-install`, and `--json`

### `microservices`
Project-level management command.

Responsibilities:

- inspect modules and docs
- add modules
- explain required secrets/resources/permissions
- run checks
- generate patches
- manage local dev helpers
- prepare preview deploys
- call hosted control plane when a user signs in

MVP commands:

```bash
microservices templates list --json
microservices modules list --json
microservices docs booking
microservices add payment-stripe --plan --json
microservices secrets status --json
microservices check --json
microservices dev
microservices deploy preview --json
microservices deploy status --json
microservices deploy logs --json
```

## Agent Workflow
For a new app:

1. Agent reads the quickstart or user instruction.
2. Agent runs `pnpm create microservices-app booking-demo --template booking-business`.
3. Agent opens the generated project.
4. Agent reads `README.agent.md`, `microservices.lock.json`, and `docs/llms.txt`.
5. Agent runs `microservices modules list --json`.
6. Agent runs `microservices docs booking`.
7. Agent customizes config and hooks first.
8. Agent runs `microservices check --json`.
9. Agent runs `microservices add payment-stripe --plan --json` when payment is needed.
10. Agent explains required secrets and approval gates.
11. Agent deploys preview only after the user signs in and approves side effects.

For existing projects:

1. User brings a Git repo.
2. Agent runs `microservices init` or `microservices attach`.
3. CLI detects framework/runtime compatibility.
4. Agent proposes module install plan.
5. microservices.sh produces a patch or branch.
6. User reviews changes before preview or production deploy.

## How A Module Is Enabled
`microservices add <module-id>` should not blindly paste snippets.

It should:

1. fetch module metadata and docs
2. resolve dependencies
3. inspect required secrets, resources, permissions, migrations, hooks, and events
4. generate an install plan
5. request approval for gated side effects
6. add source files or dependency references
7. update route composition and bindings
8. update migrations and `microservices.lock.json`
9. run checks
10. produce a readable summary for the agent and user

For MVP, module code can be vendored into the generated app for inspectability. Later, module packages can be installed as versioned dependencies if upgrade tooling is strong enough.

## Module Updates
Every generated project needs a lock file:

```text
microservices.lock.json
```

It should record:

- template id and version
- module ids and versions
- provider module versions
- generated file fingerprints
- hook/customization files
- migrations applied
- resources required
- known manual edits or forked modules

Upgrade flow:

```bash
microservices updates --json
microservices upgrade booking --plan --json
microservices upgrade booking --apply
microservices check --json
```

Rules:

- config and hook changes should be upgradeable
- overlays require merge review
- forked modules are user-owned and upgrade manually or with agent assistance
- migrations and provider-module changes require approval
- production upgrades require explicit confirmation

## Source Ownership And Deployment
Default:

> The user owns the repo. microservices.sh proposes changes, runs checks, and manages previews.

MVP source flows:

| Flow | Use Case | Decision |
|------|----------|----------|
| Generated local folder | First demo and validation | Required first. |
| User-owned Git repo | Serious pilot work | Required for paid beta. |
| microservices.sh-created repo | Users who want setup help | Useful after create flow. |
| Managed source only | Black-box builder | Avoid for MVP. |

Deployment sequence:

1. local generation
2. local checks
3. preview deploy through managed Cloudflare after login
4. production deploy only after explicit approval
5. BYO Cloudflare later

## Success Criteria
This direction is working when:

- 80 percent of qualified test users can run the create command and start local dev in under 10 minutes
- 5 external users generate a booking app from docs only
- 3 users add or plan a provider module without support
- generated apps pass checks
- users understand required secrets before adding `payment-stripe`
- at least 3 paid-pilot prospects say the create flow is clearer than MCP-first setup

## Development Plan
### Slice 1: Create Package
- package `create-microservices-app`
- local template generation
- package-manager detection
- `--json` output
- generated `README.agent.md`
- generated `docs/llms.txt`
- generated `microservices.lock.json`
- bundled npm artifact with no runtime workspace dependencies
- manual npm publish workflow with dry-run default and provenance support

### Slice 2: Project CLI
- expose `microservices` command in generated app
- `docs <module>`
- `modules list`
- `add <module> --plan`
- `secrets status`
- `updates`
- `upgrade <module> --plan`
- `check`
- `dev`

### Slice 3: Module Add Planning
- plan-only add flow for `payment-stripe`
- permission gate output
- secret/resource matrix
- migration preview
- patch summary
- plan-only upgrade flow for locked modules
- lockfile contract snapshot for route, resource, permission, hook, dependency, and event diffs

### Slice 4: Managed Preview
- login
- create project
- upload artifact
- provision D1/KV
- upload Worker
- return preview URL

### Slice 5: MCP Parity
- expose the same SDK functions through hosted MCP
- publish MCP docs after the create flow works
- submit to MCP directories only after install and docs are credible

## Template Expansion After Core
After create, lockfile, docs, add-plan, update, and upgrade-plan flows are stable, add predefined starting repositories as templates.

Recommended order:

1. `booking-sveltekit`: full Cloudflare SvelteKit booking app with public booking flow, admin surface, D1, KV, hooks, audit events, generated docs, and upgrade-plan support.
2. `landing-page`: simple marketing site with waitlist/contact capture, analytics events, and deploy-ready Cloudflare Pages/Workers conventions.
3. `blog-content`: content/CMS foundation with posts, authors, tags, RSS/sitemap, SEO metadata, and optional email capture.

Template rule: a template is not just a copied repo. It must include a template manifest, module lockfile, LLM docs, generated project CLI, upgrade-plan support, and documented customization boundaries. This keeps templates upgradeable instead of becoming disconnected starter code.

Source specs:

- `docs/templates/template-spec-standard.md`
- `docs/templates/booking-sveltekit.md`
- `templates/booking-sveltekit`

## Release Gate
The create package can be tested locally now, but public npm publication should wait until:

- `pnpm test:create` passes on GitHub Actions
- package version is selected
- public license is confirmed
- `NPM_PUBLISH_ENABLED=true` is added as a GitHub repository variable
- `NPM_TOKEN` is added as a GitHub repository secret
- first workflow run succeeds with `dry_run=true`

## Audit Verdict
The previous plan was directionally strong but over-weighted MCP as the first activation path. That creates avoidable setup friction before users see value.

The adapted plan should be:

1. CLI/create first for activation.
2. SDK underneath every surface.
3. MCP second for agent-native parity and directory discovery.
4. Managed Cloudflare preview after local generation proves trust.
5. Minimal admin UI for profile, billing, keys, projects, usage, and logs only.
