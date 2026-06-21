import { markBillPayableInputSchema } from "../schemas";
import { isoNow, normalizeOptional } from "../service";
import type { AccountsPayableEvent } from "../types";
import { err, hooks, ok, type AccountsPayableDeps } from "./shared";

export async function markBillPayable(input: unknown, deps: AccountsPayableDeps) {
  const parsed = markBillPayableInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_PAYABLE_INPUT", "Payable transition input is invalid.", deps, parsed.error.issues);
  }

  const bill = await deps.accountsPayableStore.getBill(parsed.data.tenantId, parsed.data.billId);
  if (!bill) {
    return err(404, "accounts-payable.BILL_NOT_FOUND", "Bill not found for this tenant.", deps);
  }
  if (bill.status === "void") {
    return err(409, "accounts-payable.BILL_VOID", "A void bill cannot be marked payable.", deps);
  }
  if (bill.status === "paid" || bill.status === "partial") {
    return err(409, "accounts-payable.INVALID_STATUS_TRANSITION", `Cannot mark a ${bill.status} bill payable.`, deps);
  }
  if (bill.status === "payable") {
    return ok(200, { bill, idempotent: true }, deps);
  }
  if (bill.lineItems.length === 0 || bill.totalCents <= 0) {
    return err(422, "accounts-payable.EMPTY_BILL", "Cannot mark an empty bill payable.", deps);
  }

  const filtered = await hooks(deps).beforeBillMarkPayable(bill);
  if (filtered === null) {
    return err(409, "accounts-payable.PAYABLE_ABORTED", "Payable transition was aborted by hook.", deps);
  }

  const now = isoNow(deps.now);
  filtered.status = "payable";
  filtered.approvedById = normalizeOptional(parsed.data.approvedById) ?? deps.actor?.id ?? null;
  filtered.approvedAt = now;
  filtered.apAccountId = normalizeOptional(parsed.data.apAccountId) ?? filtered.apAccountId;
  filtered.updatedAt = now;

  if (parsed.data.postToAccounting && deps.accountingPoster) {
    const posted = await deps.accountingPoster.postAccountsPayableBill({
      tenantId: filtered.tenantId,
      bill: filtered,
      apAccountId: filtered.apAccountId,
      correlationId: deps.correlationId ?? null
    });
    filtered.journalEntryId = posted.journalEntryId ?? null;
    filtered.accountingStatus = "posted";
    filtered.postedAt = now;
  }

  await deps.accountsPayableStore.updateBill(filtered);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.bill_marked_payable",
    entityType: "accounts-payable",
    entityId: filtered.id,
    tenantId: filtered.tenantId,
    payload: {
      vendorId: filtered.vendorId,
      totalCents: filtered.totalCents,
      accountingStatus: filtered.accountingStatus
    }
  };
  await deps.accountsPayableStore.writeEvent(event);
  await hooks(deps).afterBillPayable(filtered);

  return ok(200, { bill: filtered, event, idempotent: false }, deps);
}
