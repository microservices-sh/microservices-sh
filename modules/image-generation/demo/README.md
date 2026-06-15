# image-generation playground (standalone demo)

A self-contained Cloudflare Worker that exercises the `image-generation` module
**on its own** — no template, no other modules, no database. State is in-memory
(per isolate; restart clears it). Use it to try the module or sanity-check a real
provider key.

## Run

```bash
cd modules/image-generation/demo
pnpm exec wrangler dev        # → http://localhost:8787  (or pass --port 5181)
```

Open the URL, then:
- **Provider** — pick `stub` (no key, returns a deterministic fake image — good for
  trying the flow offline), or `kie-ai` / `gemini` / `gpt-image`.
- **API key** — pasted per request, used only to build the provider for that call,
  never stored. (Gemini also needs its `generateContent` endpoint URL.)
- **Prompt** + aspect ratio + optional negative prompt → **generate**.
- **Reference image** (optional) → the prompt *edits* it (runs the module's
  `editImage` use-case instead of `generateImage`).

## What it demonstrates

The Worker is ~thin glue over the module's public surface:

- `buildProvider()` constructs one adapter (`createKieAiProvider` / `…Gemini` /
  `…GptImage`, or the in-memory stub) from the request.
- `generateImage` / `editImage` use-cases run with `createMemoryImageStore` +
  `createMemoryObjectStorage`.
- `getImage` + the in-memory storage back the `/img/:id` serve route.

It imports the module from source (`../../src/index`) so it runs co-located.
Real apps import `@microservices-sh/image-generation` and swap the memory adapters
for `createD1ImageStore(DB)` + `createR2ObjectStorage(IMAGE_BUCKET)`.

## Note

This is a local dev playground. Don't deploy it publicly with shared keys — it
forwards whatever key the caller submits to the chosen provider.
