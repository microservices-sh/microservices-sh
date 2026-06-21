# Product Catalog Module

Status: `draft`

Product and category catalog with SKU uniqueness, external mappings, combo products, and catalog events.

## Public Surface

```ts
import {
  createMemoryProductCatalogStore,
  createProduct,
  listProducts
} from "@microservices-sh/product-catalog";
```

## Ownership Boundary

The module owns product identity, category assignment, SKU uniqueness, external source references, combo product expansion, schemas, hooks, events, permissions, resources, and migrations for `product-catalog`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.

## Port Notes

This is the first StackSuite commerce slice. It preserves the donor catalog behavior that should become shared infrastructure before inventory, sales order, shipment, and accounting modules depend on products.

The module intentionally stores money as integer cents and keeps external sync identifiers as `(externalSource, externalId)` pairs so WooCommerce and later commerce adapters can remain idempotent.
