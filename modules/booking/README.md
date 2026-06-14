# Booking Module

Status: `available`

This is the first source-visible prebuilt microservices.sh module. It owns booking domain behavior, schemas, use cases, repository ports, Cloudflare D1 adapters, memory adapters, hooks, events, and migration ownership.

## Public Surface

```ts
import {
  createBooking,
  getAvailability,
  getBooking,
  listBookings
} from "@microservices-sh/booking";

import type { BookingRepository } from "@microservices-sh/booking/ports";
import { createD1BookingRepository } from "@microservices-sh/booking/adapters/d1";
```

## Ownership Boundary

The module owns:

- booking use cases
- repository ports
- D1 and memory adapters
- booking schemas and types
- booking hooks and events
- D1 migration contract for booking tables

Templates own:

- app shell
- route adapters
- UI layout
- framework-specific response mapping
- local wiring to Cloudflare bindings

Dependent modules:

- `@microservices-sh/customer` owns customer create/list/read behavior and the `customers` table.

## Upgrade Rule

Templates should import this package instead of editing a template-local copy. Generated apps may vendor a source copy later for inspectability, but the vendored copy must keep a `microservices.lock.json` source entry pointing back to `registry:booking@0.1.0`.
