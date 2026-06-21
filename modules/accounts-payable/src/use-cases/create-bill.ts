import { createBillInputSchema } from "../schemas";
import {
  accountsPayableId,
  assertSuppliedTotalsMatch,
  calculateBillTotals,
  calculateLineTotals,
  isoNow,
  normalizeCurrency,
  normalizeOptional
} from "../service";
import type { AccountsPayableEvent, Bill, BillLineItem } from "../types";
import { err, hooks, ok, type AccountsPayableDeps } from "./shared";

function generatedBillNumber(id: string): string {
  return `BILL-${id.replace("bill_", "").slice(0, 8).toUpperCase()}`;
}

export async function createBill(input: unknown, deps: AccountsPayableDeps) {
  const filtered = await hooks(deps).beforeBillCreate(input);
  const parsed = createBillInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_BILL_INPUT", "Bill input is invalid.", deps, parsed.error.issues);
  }

  const vendor = await deps.accountsPayableStore.getVendor(parsed.data.tenantId, parsed.data.vendorId);
  if (!vendor) {
    return err(404, "accounts-payable.VENDOR_NOT_FOUND", "Vendor not found for this tenant.", deps);
  }

  const now = isoNow(deps.now);
  const billId = accountsPayableId("bill");
  const lineItems: BillLineItem[] = parsed.data.lineItems.map((line, index) => {
    const totals = calculateLineTotals({
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      taxCents: line.taxCents
    });
    return {
      id: accountsPayableId("bil"),
      tenantId: parsed.data.tenantId,
      billId,
      expenseAccountId: normalizeOptional(line.expenseAccountId),
      description: line.description.trim(),
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      sortOrder: index,
      createdAt: now,
      updatedAt: now
    };
  });
  const totals = calculateBillTotals(lineItems);
  const totalCheck = assertSuppliedTotalsMatch(
    {
      subtotalCents: parsed.data.subtotalCents,
      taxCents: parsed.data.taxCents,
      totalCents: parsed.data.totalCents
    },
    totals
  );
  if (!totalCheck.ok) {
    return err(
      422,
      "accounts-payable.BILL_TOTAL_MISMATCH",
      `${totalCheck.field} must equal computed line total.`,
      deps,
      [totalCheck]
    );
  }

  const bill: Bill = {
    id: billId,
    tenantId: parsed.data.tenantId,
    billNumber: parsed.data.billNumber?.trim() ?? generatedBillNumber(billId),
    vendorId: parsed.data.vendorId,
    vendorBillNumber: normalizeOptional(parsed.data.vendorBillNumber),
    status: parsed.data.requiresApproval ? "pending_approval" : "draft",
    accountingStatus: "unposted",
    billDate: parsed.data.billDate,
    dueDate: parsed.data.dueDate,
    paidAt: null,
    currency: normalizeCurrency(parsed.data.currency),
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    amountPaidCents: 0,
    amountDueCents: totals.totalCents,
    memo: parsed.data.memo ?? null,
    apAccountId: normalizeOptional(parsed.data.apAccountId),
    journalEntryId: null,
    approvedById: null,
    approvedAt: null,
    postedAt: null,
    voidedAt: null,
    voidReason: null,
    recurringTemplateId: normalizeOptional(parsed.data.recurringTemplateId),
    createdById: deps.actor?.id ?? null,
    createdAt: now,
    updatedAt: now
  };

  await deps.accountsPayableStore.insertBill(bill, lineItems);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.bill_created",
    entityType: "accounts-payable",
    entityId: bill.id,
    tenantId: bill.tenantId,
    payload: { vendorId: bill.vendorId, totalCents: bill.totalCents, status: bill.status }
  };
  await deps.accountsPayableStore.writeEvent(event);

  return ok(201, { bill: { ...bill, lineItems }, event }, deps);
}
