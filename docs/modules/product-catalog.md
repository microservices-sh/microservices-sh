# Product Catalog

Status: draft
Module ID: `product-catalog`
Mount: `/products`

## Summary
Product and category catalog with tenant-scoped SKU uniqueness, external source mappings, combo products, and catalog events.

This module is the first StackSuite commerce port slice. It should be shared by later inventory, sales order, shipment, WooCommerce sync, and accounting handoff modules instead of duplicating catalog tables per vertical.

## Dependencies
- none

## Permissions
- product-catalog.read
- product-catalog.write
- product-catalog.admin
- product-catalog.extend
- product-catalog.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- beforeCategoryCreate
- beforeProductCreate
- afterCategoryUpdated
- afterProductUpdated

## Events
- product-catalog.category_created
- product-catalog.category_updated
- product-catalog.product_created
- product-catalog.product_updated
- product-catalog.combo_updated

## Invariants
- SKU is normalized and unique per tenant.
- External references are unique per tenant, source, and external ID.
- Money is stored as integer cents.
- Simple products cannot own combo components.
- Combo components cannot point at missing products or the combo product itself.

## Approval Gate
Risk: medium

Adding migrations, changing product identity rules, changing sync identifiers, or enabling external side effects requires explicit approval.

## Update Notes
Keep this module framework-neutral. Templates own routes, UI, and app-shell navigation; this module owns catalog use cases, schemas, ports, adapters, hooks, events, permissions, resources, and migrations.
