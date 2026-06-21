# Code Memory Module

Status: `draft`

Code Memory stores Trusted Sources, immutable source versions, Logic Capsules, and audit events for agent-assisted code reuse.

## Public Surface

```ts
import {
  createCodeMemoryService,
  createCodeMemoryMemoryStore,
  createD1CodeMemoryStore
} from "@microservices-sh/code-memory";
```

## Ownership Boundary

This module owns metadata and trust state only. It does not execute untrusted repository code, mint GitHub installation tokens, apply patches to local projects, or copy source files without an explicit caller-owned workflow.
