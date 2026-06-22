# Accounts Payable

Tenant-scoped accounts payable module for vendors, bills, payable lifecycle, bill payment application, recurring bill templates, aging, and a narrow accounting posting port.

Money is stored as integer cents. The module owns AP records and emits events; host applications decide routing, auth, and accounting-core wiring.

Bill approval and accounting posting are separate: `markBillPayable` approves the payable state, while `postBillToAccounting` records the accounting handoff for approved unpaid bills.

`voidBill` supports unpaid, unposted bill voids. Posted bill reversals and payment voids are intentionally separate accounting workflows.
