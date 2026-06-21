# Code Memory + Trusted Sources

Status: draft product and implementation plan.

## Decision

Build **Code Memory** as a personal/private reuse layer for individual developers and agencies.

Do not frame this as "repo inventory" or a marketplace. The user value is sharper:

> Stop rewriting logic you already solved. Let your agent reuse your trusted code, with source, tests, and pins.

The product UI can call the source list **Trusted Sources**. The marketing feature name can be **Code Memory**. The reusable unit is a **Logic Capsule**.

## Target User

Primary:

- Individual developers who repeatedly build similar apps.
- AI-assisted builders using Codex, Cursor, Claude Code, or another coding agent.
- Agency/fractional CTO users who want their private patterns reused across client projects.

Pain:

- "I already solved this before."
- "The agent keeps inventing logic I already trust."
- "I want my own Stripe/webhook/D1/business-rule patterns reused in new apps."
- "I do not want arbitrary generated code replacing known-good logic."

## Product Model

```text
Trusted Source -> Scan -> Candidate Logic Capsules -> User Approval -> Search/Retrieve -> Apply/Adapt -> Verify
```

### Trusted Source

A repo or folder the user has approved as a source of reusable logic.

Fields:

- `id`
- `workspace_id`
- `owner_user_id`
- `provider` (`github`, later `gitlab`, `local-upload`)
- `visibility` (`workspace_private`, `shared`, `unlisted`, `public_candidate`)
- `repo_url`
- `repo_owner`
- `repo_name`
- `installation_id` for GitHub App private repos
- `default_branch`
- `allowed_paths_json`
- `created_at`
- `updated_at`

### Source Version

An immutable scan target.

Fields:

- `id`
- `source_id`
- `ref` (`main`, tag, or SHA requested by user)
- `commit_sha`
- `tree_checksum`
- `scan_status`
- `scan_summary_json`
- `created_at`

### Logic Capsule

An approved reusable unit.

Fields:

- `id`
- `workspace_id`
- `source_version_id`
- `slug`
- `name`
- `purpose`
- `reuse_mode` (`reference`, `copy`, `adapt`, `module`, `test_only`)
- `source_files_json`
- `test_files_json`
- `dependencies_json`
- `required_env_json`
- `inputs_json`
- `outputs_json`
- `usage_notes`
- `constraints`
- `do_not_use_for`
- `checksum`
- `approval_status` (`candidate`, `approved`, `archived`)
- `created_at`
- `updated_at`

### Memory Event

Audit trail for trust.

Fields:

- `id`
- `workspace_id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

## User Flow

### Add Source

Public repo:

```bash
microservices memory source add https://github.com/alex/saas-kit --path lib
```

Private repo:

1. User clicks `Connect GitHub`.
2. Installs the microservices.sh GitHub App.
3. Selects one or more repositories.
4. Returns to Trusted Sources.
5. Chooses repo, path, and ref.

Use GitHub App read-only `contents` access for private repos. Do not ask for PATs.

### Scan

Default scan is static inspection only:

- repo tree
- package manifests
- exported functions/classes/components
- schemas
- migrations
- tests
- examples/docs
- dependency hints
- probable secrets
- license file

Do not execute untrusted repo code in MVP.

### Approve Capsules

The scanner proposes candidates:

```text
stripe-webhook-verifier
invoice-numbering
booking-overlap-checker
d1-pagination-helper
svelte-admin-table
```

User approves, renames, edits purpose/notes, and archives noise. Nothing becomes canonical memory without approval.

### Retrieve Later

Natural language:

```bash
microservices memory search "stripe webhook verification"
microservices memory get stripe-webhook-verifier
```

Agent/MCP:

```text
memory.search("Stripe webhook logic")
memory.get("stripe-webhook-verifier")
memory.apply_plan("stripe-webhook-verifier", target="modules/payment")
```

Direct application:

```bash
microservices memory use stripe-webhook-verifier --into modules/payment --mode adapt
```

Retrieval result should include:

- capsule name and purpose
- source repo/path/commit
- relevant source files
- tests/examples
- dependencies and required env
- constraints and "do not use for"
- apply plan
- verification commands

## Agent Skill

The `code-memory` skill is the behavior layer. It tells agents:

- search approved memory before writing new reusable logic
- retrieve source, tests, constraints, and provenance
- adapt instead of blindly copying when boundaries differ
- run focused tests
- suggest saving new reusable logic as a capsule when no memory exists

The product needs both:

- storage/retrieval APIs for Trusted Sources and Logic Capsules
- the `code-memory` skill so agents actually check memory at the right time

## CLI Surface

MVP metadata/retrieval commands:

```bash
microservices memory source add <repo-url> [--path <path>] [--ref <ref>]
microservices memory source list
microservices memory source scan <source-id>
microservices memory capsule create --source <source-id> --name <name> --purpose <purpose>
microservices memory approve <capsule-id-or-slug>
microservices memory reject <capsule-id-or-slug>
microservices memory search <query>
microservices memory get <capsule-id>
```

Planned apply commands:

```bash
microservices memory candidates <source-id>
microservices memory use <capsule-id> --into <path> [--mode reference|copy|adapt|module|test-only]
```

For generated apps, the project CLI can proxy authenticated calls to the control-plane API. The MVP should return metadata, provenance, constraints, and file/test references only; later apply commands should write chosen capsule files/patches locally after an explicit user request.

## MCP Surface

Initial tools:

- `memory_list_sources`
- `memory_scan_source`
- `memory_list_candidates`
- `memory_approve_candidate`
- `memory_search`
- `memory_get`
- `memory_apply_plan`
- `memory_save_candidate`

Do not let MCP auto-apply code from memory without an explicit user request. For mutation, return a plan first unless the user asked for direct edits in the local workspace.

## Validation Rules

Block or warn on:

- detected secrets or private keys
- missing license or unclear reuse rights
- large unrelated folders
- import-time side effects
- provider writes in reusable helpers
- auth/signature/tenant/billing logic without tests
- capsules without stable source commit

Require strong warnings for security-sensitive capsules:

- auth/session/token logic
- webhook verification
- payment and refund logic
- tenant scoping and row-level authorization
- migrations touching production data

## Storage And Search

MVP:

- store source/capsule metadata in D1
- store small capsule file snapshots in D1 or R2
- keyword search over capsule purpose, names, paths, docs, and tags
- keep original repo provenance and commit SHA on every capsule

Later:

- embeddings for semantic retrieval
- code-aware symbol graph
- dependency and call graph extraction
- "similar prior solution" suggestions during module generation

## Security Model

- GitHub App, not PATs.
- Read-only `contents` permission for private repos.
- Selected repositories only.
- Installation tokens minted server-side and short-lived.
- No GitHub tokens exposed to CLI, MCP clients, or generated apps.
- No untrusted code execution during scan.
- All capsule reads and applications are workspace-scoped.
- Audit every source add, scan, approval, retrieval, and apply-plan event.

## Packaging

Free:

- public Trusted Sources
- limited capsule count
- local/project CLI retrieval

Builder:

- private GitHub App sources
- more capsules
- MCP retrieval

Agency:

- shared source libraries across client workspaces
- client-specific allow lists
- capsule usage reporting

Enterprise:

- GitHub Enterprise/GitLab
- custom policy gates
- stricter audit/export controls

## Marketing

Primary message:

> Reuse the code you already trust.

Supporting message:

> Connect your repos once. microservices.sh turns your proven logic into private building blocks your AI agent can find, adapt, and verify in every new app.

Developer line:

> Your agent should not reinvent your Stripe webhooks, invoice logic, booking rules, D1 helpers, or admin components. It should reuse yours.

Agency line:

> Turn your agency IP into a private module library your agents can reuse across every client build.

Avoid:

- "AI trains on your repo"
- "repo inventory"
- "marketplace" for the MVP
- broad claims that the agent understands all code automatically

## Implementation Phases

### Phase 0: Skill

Done:

- Add `code-memory` skill to local `.agents/skills`.
- Add distributable `skills/code-memory`.

### Phase 1: Public Source MVP

- Add D1 tables for sources, source versions, capsules, events.
- Add API endpoints for public repo add/scan/list/search/get.
- Use GitHub public archive/tarball or contents API.
- Add static scanner for TypeScript/JavaScript manifests, exports, docs, and tests.
- Add CLI `memory source add`, `memory search`, `memory get`.

Success gate:

- User can add a public repo, approve a capsule, and retrieve it in a new project with provenance.

### Phase 2: Private GitHub App

- Add GitHub App install flow.
- Store installation metadata.
- Mint short-lived installation tokens server-side.
- Fetch private repo contents through the API/broker.
- Add audit events for private source access.

Success gate:

- Private repo source can be scanned and retrieved without exposing credentials to CLI/MCP.

### Phase 3: Agent Retrieval

- Add MCP memory tools.
- Update generated project CLI to proxy memory retrieval.
- Teach `microservices-sh` skill or generated `README.agent.md` to mention Code Memory only when configured.

Success gate:

- Agent can find and adapt a user-approved capsule instead of rewriting logic.

### Phase 4: Apply + Save Loop

- Add `memory use --mode adapt`.
- Add apply-plan output before mutation.
- Add "save this as a capsule" from newly written code.
- Add capsule update validation for new commits/tags.

Success gate:

- A developer can reuse prior logic, verify it, then save newly reusable code back to memory.

## Open Questions

- Should capsules snapshot source files or fetch live by commit on every retrieval? Initial answer: snapshot small files and preserve source commit.
- Should public sources be visible in public registry? Initial answer: no; keep workspace-private until public listing review exists.
- Should retrieval use embeddings at MVP? Initial answer: no; start with deterministic metadata/keyword search.
- How much scanner intelligence is enough? Initial answer: propose candidates from manifests, exports, docs, tests, and user-selected paths; let user approval do the trust work.
