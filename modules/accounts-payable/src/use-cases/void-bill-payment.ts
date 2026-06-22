import { voidBillPaymentInputSchema } from "../schemas";
import { isoNow, normalizeOptional } from "../service";
import type {
  AccountsPayableEvent,
  Bill,
  BillPayment,
  BillPaymentWithApplications
} from "../types";
import { err, hooks, ok, type AccountsPayableDeps } from "./shared";

function restoreBillAfterApplicationVoid(bill: Bill, amountAppliedCents: number, now: string): Bill {
  const amountPaidCents = Math.max(0, bill.amountPaidCents - amountAppliedCents);
  const amountDueCents = Math.max(0, bill.totalCents - amountPaidCents);
  const status = amountDueCents === 0 ? "paid" : amountPaidCents > 0 ? "partial" : "payable";
  return {
    ...bill,
    status,
    amountPaidCents,
    amountDueCents,
    paidAt: status === "paid" ? bill.paidAt : null,
    updatedAt: now
  };
}

export async function voidBillPayment(input: unknown, deps: AccountsPayableDeps) {
  const parsed = voidBillPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_PAYMENT_VOID_INPUT", "Bill payment void input is invalid.", deps, parsed.error.issues);
  }

  const payment = await deps.accountsPayableStore.getPayment(parsed.data.tenantId, parsed.data.paymentId);
  if (!payment) {
    return err(404, "accounts-payable.BILL_PAYMENT_NOT_FOUND", "Bill payment not found for this tenant.", deps);
  }
  if (payment.status === "void") {
    return ok(200, { payment, bills: [], event: null, reversalEntryId: null, idempotent: true }, deps);
  }
  if (payment.status !== "posted") {
    return err(409, "accounts-payable.BILL_PAYMENT_NOT_VOIDABLE", "Only posted bill payments can be voided.", deps);
  }

  const filtered = await hooks(deps).beforeBillPaymentVoid(payment);
  if (filtered === null) {
    return err(409, "accounts-payable.BILL_PAYMENT_VOID_ABORTED", "Bill payment void was aborted by hook.", deps);
  }

  const now = isoNow(deps.now);
  const sourceBills = await Promise.all(
    filtered.applications.map((application) => deps.accountsPayableStore.getBill(filtered.tenantId, application.billId))
  );
  const updatedBills: Bill[] = [];
  for (const [index, bill] of sourceBills.entries()) {
    const application = filtered.applications[index];
    if (!bill) {
      return err(
        409,
        "accounts-payable.BILL_PAYMENT_APPLICATION_BILL_NOT_FOUND",
        `Bill ${application.billId} linked to this payment was not found.`,
        deps
      );
    }
    updatedBills.push(restoreBillAfterApplicationVoid(bill, application.amountAppliedCents, now));
  }

  let reversalEntryId: string | null = null;
  if (filtered.journalEntryId) {
    if (!deps.accountingPoster?.voidAccountsPayablePayment) {
      return err(
        409,
        "accounts-payable.BILL_PAYMENT_REQUIRES_ACCOUNTING_REVERSAL",
        "Accounting-posted bill payments require an accounting reversal before AP balances are updated.",
        deps
      );
    }
    const reversed = await deps.accountingPoster.voidAccountsPayablePayment({
      tenantId: filtered.tenantId,
      payment: filtered,
      reason: normalizeOptional(parsed.data.reason),
      voidedById: normalizeOptional(parsed.data.voidedById) ?? deps.actor?.id ?? null,
      reversalDate: parsed.data.reversalDate ?? null,
      reversalPeriodId: normalizeOptional(parsed.data.reversalPeriodId),
      correlationId: deps.correlationId ?? null
    });
    reversalEntryId = reversed.reversalEntryId ?? null;
  }

  const voidedPayment: BillPayment = {
    ...filtered,
    status: "void",
    voidedAt: now,
    voidReason: normalizeOptional(parsed.data.reason),
    updatedAt: now
  };
  await deps.accountsPayableStore.voidPaymentWithBillUpdates({ payment: voidedPayment, updatedBills });

  const paymentWithApplications: BillPaymentWithApplications = {
    ...voidedPayment,
    applications: filtered.applications
  };
  const totalAppliedCents = filtered.applications.reduce((sum, application) => sum + application.amountAppliedCents, 0);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.bill_payment_voided",
    entityType: "accounts-payable",
    entityId: voidedPayment.id,
    tenantId: voidedPayment.tenantId,
    payload: {
      vendorId: voidedPayment.vendorId,
      paymentNumber: voidedPayment.paymentNumber,
      amountCents: voidedPayment.amountCents,
      appliedCents: totalAppliedCents,
      originalJournalEntryId: voidedPayment.journalEntryId,
      reversalEntryId,
      reason: voidedPayment.voidReason,
      voidedById: normalizeOptional(parsed.data.voidedById) ?? deps.actor?.id ?? null
    }
  };
  await deps.accountsPayableStore.writeEvent(event);
  await hooks(deps).afterBillPaymentVoided(paymentWithApplications);

  return ok(200, { payment: paymentWithApplications, bills: updatedBills, event, reversalEntryId, idempotent: false }, deps);
}
