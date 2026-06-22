import { voidBillInputSchema } from "../schemas";
import { isoNow, normalizeOptional } from "../service";
import type { AccountsPayableEvent } from "../types";
import { err, hooks, ok, type AccountsPayableDeps } from "./shared";

export async function voidBill(input: unknown, deps: AccountsPayableDeps) {
  const parsed = voidBillInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_VOID_INPUT", "Bill void input is invalid.", deps, parsed.error.issues);
  }

  const bill = await deps.accountsPayableStore.getBill(parsed.data.tenantId, parsed.data.billId);
  if (!bill) {
    return err(404, "accounts-payable.BILL_NOT_FOUND", "Bill not found for this tenant.", deps);
  }
  if (bill.status === "void") {
    return ok(200, { bill, event: null, idempotent: true }, deps);
  }
  if (bill.amountPaidCents > 0 || bill.status === "partial" || bill.status === "paid") {
    return err(
      409,
      "accounts-payable.BILL_HAS_PAYMENTS",
      "Void payments before voiding this bill.",
      deps
    );
  }
  const filtered = await hooks(deps).beforeBillVoid(bill);
  if (filtered === null) {
    return err(409, "accounts-payable.BILL_VOID_ABORTED", "Bill void was aborted by hook.", deps);
  }

  const now = isoNow(deps.now);
  let reversalEntryId: string | null = null;
  if (filtered.accountingStatus === "posted" || filtered.journalEntryId) {
    if (!filtered.journalEntryId || !deps.accountingPoster?.voidAccountsPayableBill) {
      return err(
        409,
        "accounts-payable.BILL_REQUIRES_ACCOUNTING_REVERSAL",
        "Posted bills require an accounting reversal before AP status is voided.",
        deps
      );
    }
    const reversed = await deps.accountingPoster.voidAccountsPayableBill({
      tenantId: filtered.tenantId,
      bill: filtered,
      reason: normalizeOptional(parsed.data.reason),
      voidedById: normalizeOptional(parsed.data.voidedById) ?? deps.actor?.id ?? null,
      reversalDate: parsed.data.reversalDate ?? null,
      reversalPeriodId: normalizeOptional(parsed.data.reversalPeriodId),
      correlationId: deps.correlationId ?? null
    });
    reversalEntryId = reversed.reversalEntryId ?? null;
  }

  const voided = {
    ...filtered,
    status: "void" as const,
    amountDueCents: 0,
    voidedAt: now,
    voidReason: normalizeOptional(parsed.data.reason),
    updatedAt: now
  };

  await deps.accountsPayableStore.updateBill(voided);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.bill_voided",
    entityType: "accounts-payable",
    entityId: voided.id,
    tenantId: voided.tenantId,
    payload: {
      vendorId: voided.vendorId,
      totalCents: voided.totalCents,
      originalJournalEntryId: voided.journalEntryId,
      reversalEntryId,
      reason: voided.voidReason,
      voidedById: normalizeOptional(parsed.data.voidedById) ?? deps.actor?.id ?? null
    }
  };
  await deps.accountsPayableStore.writeEvent(event);
  await hooks(deps).afterBillVoided(voided);

  return ok(200, { bill: voided, event, reversalEntryId, idempotent: false }, deps);
}
