import { postBillToAccountingInputSchema } from "../schemas";
import { isoNow, normalizeOptional } from "../service";
import type { AccountsPayableEvent } from "../types";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function postBillToAccounting(input: unknown, deps: AccountsPayableDeps) {
  const parsed = postBillToAccountingInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_POST_INPUT", "Bill posting input is invalid.", deps, parsed.error.issues);
  }

  const bill = await deps.accountsPayableStore.getBill(parsed.data.tenantId, parsed.data.billId);
  if (!bill) {
    return err(404, "accounts-payable.BILL_NOT_FOUND", "Bill not found for this tenant.", deps);
  }
  if (bill.status === "void") {
    return err(409, "accounts-payable.BILL_VOID", "A void bill cannot be posted to accounting.", deps);
  }
  if (bill.accountingStatus === "posted") {
    return ok(200, { bill, idempotent: true }, deps);
  }
  if (bill.status !== "payable") {
    return err(
      409,
      "accounts-payable.BILL_NOT_APPROVED",
      "Approve the bill before posting it to accounting.",
      deps
    );
  }
  if (bill.amountPaidCents > 0 || bill.amountDueCents !== bill.totalCents) {
    return err(
      409,
      "accounts-payable.BILL_PAYMENT_STATE_CHANGED",
      "Post the bill to accounting before recording payments.",
      deps
    );
  }
  if (bill.lineItems.length === 0 || bill.totalCents <= 0) {
    return err(422, "accounts-payable.EMPTY_BILL", "Cannot post an empty bill to accounting.", deps);
  }
  if (!deps.accountingPoster) {
    return err(
      409,
      "accounts-payable.ACCOUNTING_POSTER_REQUIRED",
      "An accounting poster is required to post this bill.",
      deps
    );
  }

  const now = isoNow(deps.now);
  const nextBill = {
    ...bill,
    apAccountId: normalizeOptional(parsed.data.apAccountId) ?? bill.apAccountId,
    updatedAt: now
  };
  const posted = await deps.accountingPoster.postAccountsPayableBill({
    tenantId: nextBill.tenantId,
    bill: nextBill,
    apAccountId: nextBill.apAccountId,
    correlationId: deps.correlationId ?? null
  });

  nextBill.journalEntryId = posted.journalEntryId ?? null;
  nextBill.accountingStatus = "posted";
  nextBill.postedAt = now;

  await deps.accountsPayableStore.updateBill(nextBill);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.bill_posted",
    entityType: "accounts-payable",
    entityId: nextBill.id,
    tenantId: nextBill.tenantId,
    payload: {
      vendorId: nextBill.vendorId,
      journalEntryId: nextBill.journalEntryId,
      accountingStatus: nextBill.accountingStatus
    }
  };
  await deps.accountsPayableStore.writeEvent(event);

  return ok(200, { bill: nextBill, event, idempotent: false }, deps);
}
