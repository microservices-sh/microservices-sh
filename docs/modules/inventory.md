# Inventory

Status: draft
Module ID: `inventory`
Mount: `/inventory`

## Summary
Tenant-scoped inventory ledger with stock movements, reservations, deductions, reconciliation documents, low-stock alert read models, and derived balances.

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
- inventory.reconciliation_document_created
- inventory.reconciliation_document_completed

## Invariants
- Stock balance is derived from movements.
- Reservation, release, deduction, and reconciliation use source references to avoid duplicate effects.
- Reconciliation document completion creates line-scoped adjustment movements with document line ids as source references.
- Available stock is on hand minus reserved.

## Approval Gate
Risk: medium

Stock adjustments, migrations, production deploys, and external side effects require explicit approval.
