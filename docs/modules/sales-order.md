# Sales Order

Status: draft
Module ID: `sales-order`
Mount: `/sales-orders`

## Summary
Tenant-scoped sales orders with line items, external references, status transitions, bulk confirm/cancel, send attempts, reservation handoff, and invoice draft handoff.

## Dependencies
- none required
- optional: inventory, invoice, email, audit-log

## Permissions
- sales-order.read
- sales-order.write
- sales-order.admin
- sales-order.extend
- sales-order.observe

## Resources
- D1

## Hooks
- beforeSalesOrderCreate
- beforeSalesOrderConfirm
- beforeSalesOrderCancel
- beforeSalesOrderInvoice
- beforeSalesOrderSend
- afterSalesOrderUpdated

## Events
- sales-order.order_created
- sales-order.order_confirmed
- sales-order.order_cancelled
- sales-order.order_invoiced
- sales-order.order_sent
- sales-order.order_send_failed

## Invariants
- Money is stored as integer cents.
- External references are unique per tenant and source.
- Orders follow draft, confirmed, cancelled, and invoiced status transitions.
- Reservation, invoice, and delivery handoff happen through ports, not template code.
- Sales-order sends record attempt metadata and never store provider secrets.
- Bulk transitions are limited to confirm/cancel and report per-order partial results; bulk invoice handoff remains deferred until invoice creation has end-to-end idempotency.

## Approval Gate
Risk: medium

Order mutations, migrations, production deploys, and external side effects require explicit approval.
