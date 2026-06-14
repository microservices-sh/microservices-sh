# Third-Party Module Governance

## Maturity Levels

| Level | Meaning | Where it lives |
| --- | --- | --- |
| Proposed | Idea is under discussion | Issue in `microservices-sh/modules` |
| Experimental | Works for early users but not verified | External repo/package |
| Listed | Discoverable in registry with caveats | Registry metadata |
| Verified | Meets module contract, tests, docs, and security review | Registry plus source repo |
| Official | Maintained by microservices.sh as part of core product | `microservices-sh/modules`, with pinned private-core snapshots for release |

## Acceptance Criteria

Before a third-party module can be listed as verified, it must provide:

- source-visible implementation
- stable module manifest
- LLM-readable docs
- typed config and payload schemas
- migration files when storage is owned
- unit or integration tests for core behavior
- local/test mode
- explicit permissions, resources, hooks, events, and secrets
- no import-time side effects
- documented failure modes
- documented upgrade and rollback behavior
- named maintainers

Provider modules must also provide:

- test-mode provider setup
- webhook signature verification where applicable
- least-privilege provider scopes
- replay/idempotency behavior for webhooks and jobs
- explicit approval gates for production side effects

## Review Checklist

Reviewers should block a module if:

- it asks for secret values in chat, docs, logs, CLI output, or MCP output
- it mutates external state during import
- it bypasses approval gates for payment, email, migration, webhook, or production behavior
- it hides meaningful behavior in a provider black box
- it lacks enough tests to catch basic workflow regressions
- it cannot explain required resources and permissions to an agent
- ownership is unclear

## Default Policy

The registry can list more modules than microservices.sh owns.

The public modules repo should accept only modules that have clear ownership, review evidence, and safe operational boundaries. The private core repo should import only modules that are important to the MVP, broadly reusable, well-tested, and maintainable by the core maintainers.
