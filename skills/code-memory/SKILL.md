---
name: code-memory
description: Use when the user wants an agent to reuse known-good code from their prior repos, Trusted Sources, Logic Capsules, personal/private code memory, or asks not to rewrite logic they already have. Also use when implementing reusable backend logic, integrations, schemas, migrations, tests, or components and the user says to use their existing patterns or repo memory.
metadata:
  version: 0.1.0
---

# Code Memory

Use this skill to prevent the agent from reinventing logic the user already owns.

Core rule:

> Search approved user memory before writing new reusable logic.

## When To Use

Use this skill when the request mentions:

- Code Memory
- Trusted Sources
- Logic Capsules
- personal module library
- private source catalog
- prior repos or existing repos
- "do not rewrite"
- "reuse my logic"
- "use the code I already know"
- "I solved this before"

Also consider it for reusable application primitives such as auth, billing, Stripe webhooks, invoice numbering, booking rules, D1 helpers, pagination, schemas, migrations, tests, admin components, and provider integrations.

## Workflow

1. Clarify the target behavior if the request is ambiguous.
2. Search memory before implementing.
3. Retrieve the best matching capsule or source.
4. Inspect provenance and constraints before adapting.
5. Apply only the relevant code or pattern.
6. Preserve provenance in the result or plan.
7. Run or add focused tests.
8. If no memory exists, implement normally and suggest saving the result as a new capsule.

## Retrieval Priority

Use the first available retrieval path:

1. Code Memory / Trusted Sources tools, if available in the environment.
2. MCP tools exposed by the project for memory, sources, registry, or modules.
3. Local repo search with `rg`, looking for matching logic and docs.
4. Ask the user for the source repo/path only if no discoverable memory path exists.

Do not claim that memory was searched if no memory tool or local source was actually searched.

## Capsule Shape

When retrieving or creating a Logic Capsule, preserve these fields when possible:

```yaml
id:
name:
purpose:
source:
  provider:
  repo:
  path:
  commit:
  url:
files:
dependencies:
required_env:
inputs:
outputs:
tests:
usage_notes:
constraints:
do_not_use_for:
checksum:
visibility:
```

## Reuse Modes

Choose the least invasive mode that satisfies the request:

- `reference`: explain or point to existing code without changing files.
- `copy`: copy known-good files with minimal adaptation.
- `adapt`: translate the pattern into the current project's conventions.
- `module`: wrap the logic into a microservices.sh module shape.
- `test-only`: reuse tests or fixtures to validate a fresh implementation.

Prefer `adapt` over raw copy when framework boundaries, tenant scoping, secrets, or runtime differences matter.

## Safety Rules

- Do not execute untrusted repo code during inspection.
- Do not copy secrets, `.env` values, tokens, private keys, or customer data.
- Do not copy license-restricted code into a project unless the user has confirmed they own or may reuse it.
- Do not vendor large unrelated folders; retrieve only the minimal relevant files.
- Do not silently change security-sensitive behavior such as auth, signature verification, tenant scoping, billing, or webhook idempotency.
- Treat generated adaptations as new code that must pass tests.

## Agent Response Pattern

When memory is found, summarize:

```text
Found: <capsule id>
Source: <repo/path>@<commit>
Use: <one-line purpose>
Plan: <copy/adapt/module/test-only>
Verification: <tests/checks to run>
```

When memory is not found:

```text
I did not find an approved memory for this. I will implement it directly, then this can be saved as a new capsule if it proves reusable.
```

## Good Applications

- Reusing a Stripe webhook verifier instead of reimplementing signature checks.
- Reusing invoice number allocation logic with its race-condition tests.
- Reusing booking overlap rules and fixtures.
- Reusing D1 pagination and query helpers.
- Reusing Svelte admin table components.
- Turning a repeated helper into a microservices.sh module.

## Bad Applications

- Treating an entire repo as canonical memory without user approval.
- Copying a stale pattern when current project conventions differ.
- Using memory to bypass security review.
- Creating one skill per small helper. Use capsules for small units; reserve new skills for broad workflows.
