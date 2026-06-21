# Commerce Sync Module

Status: `draft`

Provider-neutral commerce connections, mappings, sync runs, webhook receipts, and normalized payload envelopes.

## Public Surface

```ts
import {
  commerceSyncModule,
  createD1CommerceSyncStore,
  createCommerceSyncService,
  createCommerceSyncMemoryService,
  createMemoryCommerceSyncStore
} from "@microservices-sh/commerce-sync";
```

`createCommerceSyncService({ store })` is the durable-adapter-ready path. It uses the `CommerceSyncStore`
port and returns promise-based module results. `createMemoryCommerceSyncStore()` provides a store adapter for
unit tests and non-D1 runtimes. `createD1CommerceSyncStore(DB)` provides the Cloudflare D1-backed adapter.

`createCommerceSyncMemoryService()` remains the synchronous compatibility API from the draft module.

## Adapter Status

D1 and memory adapters are available behind the same `CommerceSyncStore` port. The D1 migration owns provider
connections, provider mappings, sync runs, webhook receipts, normalized commerce envelopes, and domain events.
Webhook payloads and normalized envelopes are serialized as JSON text.

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for `commerce-sync`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
