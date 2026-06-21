# Storage Entitlements Module

Status: `draft`

DashDrive-inspired storage quotas, packages, one-time purchases, expiring share links, and download counts for file-heavy templates.

## Public Surface

```ts
import {
  createStorageEntitlementsService,
  createD1StorageEntitlementsStore,
  createStorageEntitlementsMemoryStore
} from "@microservices-sh/storage-entitlements";
```

## Ownership Boundary

This module owns quota accounting, package and purchase state, and share-link metadata. It does not upload bytes or sign R2 URLs; those remain in `file-media` or app adapters.
