# Customer Module

Status: `available`

This is the source-visible prebuilt microservices.sh customer module. It owns customer profile behavior, schemas, use cases, repository ports, Cloudflare D1 adapters, memory adapters, hooks, events, and migration ownership for customer tables.

## Public Surface

```ts
import { getCustomer, listCustomers, upsertCustomer } from "@microservices-sh/customer";

import type { CustomerRepository } from "@microservices-sh/customer/ports";
import { createD1CustomerRepository } from "@microservices-sh/customer/adapters/d1";
```

## Ownership Boundary

The module owns:

- customer use cases
- repository ports
- D1 and memory adapters
- customer schemas and types
- customer hooks and events
- D1 migration contract for customer tables

Templates own:

- app shell
- route adapters
- UI layout
- framework-specific response mapping
- local wiring to Cloudflare bindings

## Upgrade Rule

Templates and dependent modules should import this package instead of editing a template-local copy. Generated apps may vendor a source copy later for inspectability, but the vendored copy must keep a `microservices.lock.json` source entry pointing back to `registry:customer@0.1.0`.
