# Project Progress Module

Status: `draft`

Tenant-scoped project progress tracking for generated apps. The module owns project records, worker access grants, progress timeline logs, media metadata, customer/admin/worker comments, public access-token snapshots, schemas, permissions, events, memory/D1 adapters, and D1 migrations.

## Public Surface

```ts
import {
  createProjectProgressMemoryStore,
  createProjectProgressService,
  createSequentialProjectProgressIdFactory,
  createSequentialProjectProgressTokenFactory
} from "@microservices-sh/project-progress";

const progress = createProjectProgressService({
  store: createProjectProgressMemoryStore(),
  createId: createSequentialProjectProgressIdFactory(),
  createAccessToken: createSequentialProjectProgressTokenFactory()
});
```

Core use cases:

- `createProject`
- `updateProjectStatus`
- `grantProjectAccess`
- `revokeProjectAccess`
- `createProgressLog`
- `attachProgressMedia`
- `addProjectComment`
- `getProjectSnapshot`
- `resolvePublicProject`
- `listProjects`

## Ownership Boundary

This module owns durable progress state and public project snapshot lookup by access token.

Templates or companion modules own auth/users, customer profiles, QR image generation, byte uploads, R2 object storage, signed URLs, email notifications, dashboard UI, and public route security.

The StackSuite EPMIS donor app also includes auth tables, customer records, QR rendering, R2 uploads, email logs, and Svelte UI. Those are intentionally excluded from this module.

## Verification

```sh
pnpm --filter @microservices-sh/project-progress build
pnpm --filter @microservices-sh/project-progress test
pnpm --filter @microservices-sh/project-progress check:spec
```
