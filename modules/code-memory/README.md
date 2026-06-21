# Code Memory Module

Status: `draft`

Code Memory stores Trusted Sources, immutable source versions, Logic Capsules, and audit events for agent-assisted code reuse.

## Public Surface

```ts
import {
  createCodeMemoryService,
  createCodeMemoryMemoryStore,
  createD1CodeMemoryStore,
  suggestLogicCapsulesFromFiles
} from "@microservices-sh/code-memory";
```

## Static Scanner

`suggestLogicCapsulesFromFiles` turns caller-provided file paths, optional text snippets, and exported symbol names into candidate Logic Capsules. It is deterministic and metadata-only; the caller owns repository checkout and file reading, and this module never executes scanned source code.

The scanner currently recognizes reusable patterns for Stripe webhook verification, invoice numbering, accounting journal posting, bank reconciliation, recurring invoice generation, WooCommerce sync adapters, shipment inventory reservation, printable document rendering, booking overlap checks, D1 pagination helpers, and auth/session token helpers. Feed its `candidates` and `scanSummary` into `recordSourceScan` to preserve source version provenance before review and approval.

## Local Donor Scan Workflow

Use the CLI local scan path when adapting owned repositories into microservices.sh modules or templates. The CLI reads supported text source files, skips dependency/build folders, and attaches git `commitSha` plus tree checksum when the scan directory is a git checkout.

```sh
microservices memory source add https://github.com/acme/stacksuite --path containers/accounting-system
microservices memory source scan <source-id> --dir ~/Project/stacksuite/containers/accounting-system --path containers/accounting-system --max-candidates 10
microservices memory source add https://github.com/acme/stacksuite --path containers/invoice-system-bao
microservices memory source scan <source-id> --dir ~/Project/stacksuite/containers/invoice-system-bao --path containers/invoice-system-bao --max-candidates 10
```

Review candidate Logic Capsules before approving them. For StackSuite-style ports, prefer `module` reuse mode for ledger, reconciliation, shipment, and inventory reservation flows, and `adapt` for printable documents, provider sync, numbering, and template-side import helpers.

## Tool Gateway Adapter

`createCodeMemoryToolHandlers` maps governed tool names such as `code-memory_searchLogicCapsules` and `code-memory_approveLogicCapsule` to the service methods. Generated MCP/gateway wiring can inject these handlers while the gateway owns scope checks, confirmation gates, and audit.

## Ownership Boundary

This module owns metadata and trust state only. It does not execute untrusted repository code, mint GitHub installation tokens, apply patches to local projects, or copy source files without an explicit caller-owned workflow.
