# URL Shortener Module

Status: `draft`

StackSuite URL Shortener-inspired tenant-scoped short links, redirect resolution, expiry, deactivation, and click analytics.

## Public Surface

```ts
import {
  createUrlShortenerService,
  createD1UrlShortenerStore,
  createUrlShortenerMemoryStore
} from "@microservices-sh/url-shortener";
```

## Ownership Boundary

This module owns the D1 source of truth for short links and click analytics. It does not own public route redirects, KV edge cache entries, bot filtering policy, or abuse/rate-limit enforcement; route adapters can layer those on top.
