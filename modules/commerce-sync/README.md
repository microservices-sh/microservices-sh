# Commerce Sync Module

Status: `draft`

Provider-neutral commerce connections, mappings, sync runs, webhook receipts, and normalized payload envelopes.

## Public Surface

```ts
import { commerceSyncModule } from "@microservices-sh/commerce-sync";
```

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for `commerce-sync`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.
