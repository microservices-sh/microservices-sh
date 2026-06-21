# Shipment

Status: draft
Module ID: `shipment`
Mount: `/shipments`

## Summary
Shipment batches and fulfillment workflow with idempotent completion and shipment events.

## Dependencies
- none required
- optional: inventory

## Permissions
- shipment.read
- shipment.write
- shipment.admin
- shipment.extend
- shipment.observe

## Resources
- D1

## Hooks
- beforeShipmentCreate
- beforeShipmentComplete
- afterShipmentUpdated

## Events
- shipment.created
- shipment.completed
- shipment.cancelled

## Invariants
- External references are unique per tenant and source.
- Completion references are unique per tenant.
- Duplicate completion attempts replay without duplicate inventory deduction.
- Completed shipments cannot be cancelled, and cancelled shipments cannot be completed.

## Approval Gate
Risk: medium

Shipment mutations, migrations, production deploys, and external side effects require explicit approval.
