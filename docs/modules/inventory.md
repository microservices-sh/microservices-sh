# Inventory

Status: draft
Module ID: `inventory`
Mount: `/inventory`

## Summary
Tenant-scoped inventory ledger with stock movements, reservations, deductions, reconciliation, and derived balances.

## Dependencies
- product-catalog

## Permissions
- inventory.read
- inventory.write
- inventory.admin
- inventory.extend
- inventory.observe

## Resources
- D1

## Hooks
- beforeStockIn
- beforeReservationCreate
- beforeReleaseCreate
- beforeDeductionCreate
- beforeReconciliation
- afterStockMovementRecorded

## Events
- inventory.stock_received
- inventory.stock_reserved
- inventory.stock_released
- inventory.stock_deducted
- inventory.stock_reconciled

## Invariants
- Stock balance is derived from movements.
- Reservation, release, deduction, and reconciliation use source references to avoid duplicate effects.
- Available stock is on hand minus reserved.

## Approval Gate
Risk: medium

Stock adjustments, migrations, production deploys, and external side effects require explicit approval.
