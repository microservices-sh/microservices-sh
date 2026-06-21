# Content CMS Module

Status: `draft`

Headless CMS domain module for content-heavy generated apps. It owns tenant-scoped content type definitions, field definitions, versioned entries, localization records, media metadata, locale settings, D1 migrations, memory/D1 adapters, schemas, permissions, events, and service use cases.

## Public Surface

```ts
import {
  createContentCmsMemoryStore,
  createContentCmsService,
  createSequentialContentCmsIdFactory
} from "@microservices-sh/content-cms";

const cms = createContentCmsService({
  store: createContentCmsMemoryStore(),
  createId: createSequentialContentCmsIdFactory()
});
```

Core use cases:

- `createContentType`
- `addContentField`
- `createContentEntry`
- `saveEntryVersion`
- `publishEntry`
- `archiveEntry`
- `upsertLocalization`
- `createLocale`
- `createMediaAsset`
- `getEntrySnapshot`

## Ownership Boundary

This module owns CMS business state and durable metadata. Templates own route adapters, editor UI, public rendering, preview rendering, auth/session behavior, R2 object upload flows, and CDN/public URL policy.

The StackSuite donor app also contains admin routes, setup, billing, API keys, auth, tenant quota, AI page design, and public rendering. Those were intentionally excluded from this module because they belong to existing platform modules or future templates.

## Verification

```sh
pnpm --filter @microservices-sh/content-cms build
pnpm --filter @microservices-sh/content-cms test
pnpm --filter @microservices-sh/content-cms check:spec
```
