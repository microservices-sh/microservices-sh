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

The scanner currently recognizes reusable patterns for Stripe webhook verification, invoice numbering, booking overlap checks, D1 pagination helpers, and auth/session token helpers. Feed its `candidates` and `scanSummary` into `recordSourceScan` to preserve source version provenance before review and approval.

## Ownership Boundary

This module owns metadata and trust state only. It does not execute untrusted repository code, mint GitHub installation tokens, apply patches to local projects, or copy source files without an explicit caller-owned workflow.
