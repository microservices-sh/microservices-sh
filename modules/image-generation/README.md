# Image Generation Module

Status: `available`

Text-to-image generation and editing across pluggable providers. Image bytes live
in R2 under tenant-scoped keys; gallery metadata lives in D1. A configurable
default provider with fallback keeps generation resilient when one backend is
down or rate-limited.

## Providers

| id | backend | notes |
|----|---------|-------|
| `kie-ai` | kie.ai nano-banana | async (create task → poll → download) |
| `gemini` | Google Gemini image (`responseModalities: ["IMAGE"]`) | synchronous, inline data |
| `gpt-image` | OpenAI `gpt-image-1` | synchronous, `b64_json` |

Each adapter is constructed by the host from its own API key; only wired
providers participate. Selection order: explicit override → `defaultProvider` →
`fallbackOrder` (de-duplicated, filtered to wired providers). Fallback advances
only on retryable errors (HTTP 429 / 5xx).

## Public Surface

```ts
import {
  generateImage, editImage, listImages, getImage, deleteImage, // use-cases
  createKieAiProvider, createGeminiProvider, createGptImageProvider, // provider adapters
  createD1ImageStore, createR2ObjectStorage, // production adapters
  createMemoryImageStore, createMemoryObjectStorage, createMemoryImageProvider, // test doubles
} from "@microservices-sh/image-generation";
```

Use-cases return the standard `ok(status, value, meta)` / `err(status, error, meta)`
Result envelope and emit `image.generated` / `image.edited` / `image.deleted`
events carrying the caller's `correlationId`.

### Wiring (host)

```ts
const providers = {
  ...(env.KIEAI_API_KEY ? { "kie-ai": createKieAiProvider({ apiKey: env.KIEAI_API_KEY }) } : {}),
  ...(env.GEMINI_ENDPOINT ? { gemini: createGeminiProvider({ endpoint: env.GEMINI_ENDPOINT, authHeader: { Authorization: `Bearer ${env.GEMINI_TOKEN}` } }) } : {}),
  ...(env.OPENAI_API_KEY ? { "gpt-image": createGptImageProvider({ apiKey: env.OPENAI_API_KEY }) } : {}),
};
const deps = { providers, store: createD1ImageStore(env.DB), storage: createR2ObjectStorage(env.IMAGE_BUCKET) };
const res = await generateImage({ tenantId, prompt: "a red fox", aspectRatio: "16:9" }, deps);
```

## Resources

- D1 `DB` — table `image_generations` (migration `0001_image_generation.sql`)
- R2 `IMAGE_BUCKET` — image bytes at `${tenantId}/${imageId}.${ext}`

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources,
and migrations for `image-generation`. Templates own app shell, route adapters,
UI layout, secret/binding wiring, and framework-specific response mapping.

## Develop

```bash
pnpm --filter @microservices-sh/image-generation test    # vitest (memory adapters + stubbed fetch)
pnpm --filter @microservices-sh/image-generation build   # tsc --noEmit
pnpm spec:check -- module modules/image-generation       # connection-contract check
```
