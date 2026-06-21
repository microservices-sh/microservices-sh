# Commerce Sync Module

Status: `draft`

Provider-neutral commerce connections, mappings, sync runs, webhook receipts, and normalized payload envelopes.

## Public Surface

```ts
import {
  commerceSyncModule,
  createCommerceSyncService,
  createCommerceSyncMemoryService,
  createMemoryCommerceSyncStore
} from "@microservices-sh/commerce-sync";
```

`createCommerceSyncService({ store })` is the durable-adapter-ready path. It uses the `CommerceSyncStore`
port and returns promise-based module results. `createMemoryCommerceSyncStore()` provides a store adapter for
unit tests and non-D1 runtimes.

`createCommerceSyncMemoryService()` remains the synchronous compatibility API from the draft module.

## Adapter Status

The current migration has tables for connections, provider mappings, sync runs, webhook receipts, and domain events.
It does not define a table for `NormalizedCommerceEnvelope`, which the service persists through
`normalizeCommercePayload`. A D1 adapter should be added after the envelope table shape is verified or a migration is
added for it.

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for `commerce-sync`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
