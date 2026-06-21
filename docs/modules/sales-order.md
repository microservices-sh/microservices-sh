# Sales Order

Status: draft
Module ID: `sales-order`
Mount: `/sales-orders`

## Summary
Tenant-scoped sales orders with line items, external references, status transitions, reservation handoff, and invoice draft handoff.

## Dependencies
- none required
- optional: inventory, invoice, audit-log

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
- afterSalesOrderUpdated

## Events
- sales-order.order_created
- sales-order.order_confirmed
- sales-order.order_cancelled
- sales-order.order_invoiced

## Invariants
- Money is stored as integer cents.
- External references are unique per tenant and source.
- Orders follow draft, confirmed, cancelled, and invoiced status transitions.
- Reservation and invoice handoff happen through ports, not template code.

## Approval Gate
Risk: medium

Order mutations, migrations, production deploys, and external side effects require explicit approval.
