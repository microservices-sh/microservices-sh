# HTML Renderer Module

Status: `draft`

StackSuite HTML Renderer-inspired module for publishing HTML mockup records with slug validation, TTL, assets, resolve, delete, and D1-backed metadata/content.

## Public Surface

```ts
import {
  createHtmlRendererService,
  createD1HtmlRendererStore,
  createHtmlRendererMemoryStore
} from "@microservices-sh/html-renderer";
```

## Ownership Boundary

This module owns document metadata, inline HTML content, asset metadata, expiry, and soft deletion. Public routes, password/auth policy, KV/R2 object storage, and large binary asset upload remain app-adapter concerns.
