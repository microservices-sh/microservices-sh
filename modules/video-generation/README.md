# Video Generation Module

Status: `draft`

Provider-neutral async video generation module for generated apps. It owns tenant-scoped generation jobs, provider task ids, status reconciliation, reference asset metadata, output records, schemas, permissions, events, memory/D1 adapters, and D1 migrations.

## Public Surface

```ts
import {
  createVideoGenerationMemoryStore,
  createVideoGenerationService,
  createSequentialVideoGenerationIdFactory
} from "@microservices-sh/video-generation";

const videos = createVideoGenerationService({
  store: createVideoGenerationMemoryStore(),
  createId: createSequentialVideoGenerationIdFactory(),
  provider: {
    async submitVideoJob(job) {
      return { providerTaskId: `provider_${job.id}` };
    }
  }
});
```

Core use cases:

- `createVideoJob`
- `submitVideoJob`
- `recordVideoProviderStatus`
- `attachVideoOutput`
- `cancelVideoJob`
- `getVideoJob`
- `listVideoJobs`

## Ownership Boundary

This module owns generation task state and output metadata. Templates or companion modules own provider credentials, auth, billing/credits, rate limits, moderation, R2 downloads/uploads, signed URLs, webhooks, and UI.

The StackSuite donor apps also include Svelte UI, Stripe credit packages, browser FFmpeg/story tooling, auth, email, admin screens, and Kie-specific route code. Those are intentionally excluded from this module.

## Verification

```sh
pnpm --filter @microservices-sh/video-generation build
pnpm --filter @microservices-sh/video-generation test
pnpm --filter @microservices-sh/video-generation check:spec
```
