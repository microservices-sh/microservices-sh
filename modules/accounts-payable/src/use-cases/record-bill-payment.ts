import { recordBillPaymentInputSchema } from "../schemas";
import { accountsPayableId, isoNow, normalizeCurrency, normalizeOptional } from "../service";
import type {
  AccountsPayableEvent,
  Bill,
  BillPayment,
  BillPaymentApplication,
  BillPaymentWithApplications,
  BillWithLineItems
} from "../types";
import { err, hooks, ok, type AccountsPayableDeps } from "./shared";

function generatedPaymentNumber(id: string): string {
  return `BP-${id.replace("bpay_", "").slice(0, 8).toUpperCase()}`;
}

export async function recordBillPayment(input: unknown, deps: AccountsPayableDeps) {
  const parsed = recordBillPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_PAYMENT_INPUT", "Bill payment input is invalid.", deps, parsed.error.issues);
  }

  if (parsed.data.idempotencyKey) {
    const existing = await deps.accountsPayableStore.findPaymentByIdempotencyKey(
      parsed.data.tenantId,
      parsed.data.idempotencyKey
    );
    if (existing) {
      return ok(200, { payment: existing, deduped: true }, deps);
    }
  }

  const vendor = await deps.accountsPayableStore.getVendor(parsed.data.tenantId, parsed.data.vendorId);
  if (!vendor) {
    return err(404, "accounts-payable.VENDOR_NOT_FOUND", "Vendor not found for this tenant.", deps);
  }

  const totalAppliedCents = parsed.data.applications.reduce((sum, application) => sum + application.amountCents, 0);
  if (totalAppliedCents > parsed.data.amountCents) {
    return err(
      409,
      "accounts-payable.OVERPAYMENT",
      "Total applied amount cannot exceed the payment amount.",
      deps
    );
  }

  const seenBills = new Set<string>();
  const sourceBills: BillWithLineItems[] = [];
  for (const application of parsed.data.applications) {
    if (seenBills.has(application.billId)) {
      return err(400, "accounts-payable.DUPLICATE_PAYMENT_APPLICATION", "A bill can only be listed once per payment.", deps);
    }
    seenBills.add(application.billId);

    const bill = await deps.accountsPayableStore.getBill(parsed.data.tenantId, application.billId);
    if (!bill) return err(404, "accounts-payable.BILL_NOT_FOUND", `Bill ${application.billId} not found.`, deps);
    if (bill.vendorId !== parsed.data.vendorId) {
      return err(409, "accounts-payable.VENDOR_MISMATCH", "All payment applications must target the payment vendor.", deps);
    }
    if (bill.currency !== normalizeCurrency(parsed.data.currency)) {
      return err(409, "accounts-payable.CURRENCY_MISMATCH", "Payment currency must match bill currency.", deps);
    }
    if (bill.status !== "payable" && bill.status !== "partial") {
      return err(409, "accounts-payable.BILL_NOT_PAYABLE", "Only payable or partial bills can receive payments.", deps);
    }
    if (application.amountCents > bill.amountDueCents) {
      return err(
        409,
        "accounts-payable.OVERPAYMENT",
        `Applied amount exceeds open balance for bill ${bill.billNumber}.`,
        deps
      );
    }
    sourceBills.push(bill);
  }

  const now = isoNow(deps.now);
  const paymentId = accountsPayableId("bpay");
  const payment: BillPayment = {
    id: paymentId,
    tenantId: parsed.data.tenantId,
    paymentNumber: generatedPaymentNumber(paymentId),
    vendorId: parsed.data.vendorId,
    paymentDate: parsed.data.paymentDate,
    amountCents: parsed.data.amountCents,
    unappliedAmountCents: parsed.data.amountCents - totalAppliedCents,
    currency: normalizeCurrency(parsed.data.currency),
    paymentAccountId: normalizeOptional(parsed.data.paymentAccountId),
    paymentMethod: parsed.data.paymentMethod ?? null,
    referenceNumber: normalizeOptional(parsed.data.referenceNumber),
    memo: parsed.data.memo ?? null,
    status: "posted",
    idempotencyKey: parsed.data.idempotencyKey ?? null,
    journalEntryId: null,
    postedAt: now,
    voidedAt: null,
    voidReason: null,
    createdById: deps.actor?.id ?? null,
    createdAt: now,
    updatedAt: now
  };

  const applications: BillPaymentApplication[] = parsed.data.applications.map((application) => ({
    id: accountsPayableId("bpa"),
    tenantId: parsed.data.tenantId,
    paymentId,
    billId: application.billId,
    amountAppliedCents: application.amountCents,
    appliedAt: now,
    createdAt: now
  }));

  const updatedBills: Bill[] = sourceBills.map((bill) => {
    const application = parsed.data.applications.find((candidate) => candidate.billId === bill.id);
    const amountApplied = application?.amountCents ?? 0;
    const amountPaidCents = bill.amountPaidCents + amountApplied;
    const amountDueCents = Math.max(0, bill.totalCents - amountPaidCents);
    return {
      ...bill,
      status: amountDueCents === 0 ? "paid" : "partial",
      amountPaidCents,
      amountDueCents,
      paidAt: amountDueCents === 0 ? now : bill.paidAt,
      updatedAt: now
    };
  });

  const paymentWithApplications: BillPaymentWithApplications = { ...payment, applications };
  if (deps.accountingPoster) {
    const posted = await deps.accountingPoster.postAccountsPayablePayment({
      tenantId: payment.tenantId,
      payment: paymentWithApplications,
      bills: sourceBills,
      correlationId: deps.correlationId ?? null
    });
    payment.journalEntryId = posted.journalEntryId ?? null;
    paymentWithApplications.journalEntryId = payment.journalEntryId;
  }

  await deps.accountsPayableStore.insertPaymentWithApplications({ payment, applications, updatedBills });

  const events: AccountsPayableEvent[] = [
    {
      eventName: "accounts-payable.bill_payment_recorded",
      entityType: "accounts-payable",
      entityId: payment.id,
      tenantId: payment.tenantId,
      payload: {
        vendorId: payment.vendorId,
        amountCents: payment.amountCents,
        appliedCents: totalAppliedCents,
        idempotencyKey: payment.idempotencyKey
      }
    }
  ];

  for (const bill of updatedBills) {
    if (bill.status === "paid") {
      events.push({
        eventName: "accounts-payable.bill_paid",
        entityType: "accounts-payable",
        entityId: bill.id,
        tenantId: bill.tenantId,
        payload: { vendorId: bill.vendorId, amountPaidCents: bill.amountPaidCents }
      });
    }
    await hooks(deps).afterBillPaymentRecorded({ ...bill, lineItems: sourceBills.find((source) => source.id === bill.id)?.lineItems ?? [] });
  }

  for (const event of events) {
    await deps.accountsPayableStore.writeEvent(event);
  }

  return ok(201, { payment: paymentWithApplications, bills: updatedBills, events, deduped: false }, deps);
}
