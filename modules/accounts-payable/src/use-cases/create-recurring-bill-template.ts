import { createRecurringBillTemplateInputSchema } from "../schemas";
import {
  accountsPayableId,
  assertSuppliedTotalsMatch,
  calculateBillTotals,
  calculateLineTotals,
  isoNow,
  nextRecurringBillDate,
  normalizeCurrency,
  normalizeOptional
} from "../service";
import type { AccountsPayableEvent, RecurringBillLineItem, RecurringBillTemplate } from "../types";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function createRecurringBillTemplate(input: unknown, deps: AccountsPayableDeps) {
  const parsed = createRecurringBillTemplateInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "accounts-payable.INVALID_RECURRING_BILL_INPUT",
      "Recurring bill template input is invalid.",
      deps,
      parsed.error.issues
    );
  }

  const vendor = await deps.accountsPayableStore.getVendor(parsed.data.tenantId, parsed.data.vendorId);
  if (!vendor) return err(404, "accounts-payable.VENDOR_NOT_FOUND", "Vendor not found for this tenant.", deps);

  const now = isoNow(deps.now);
  const templateId = accountsPayableId("rbt");
  const lineItems: RecurringBillLineItem[] = parsed.data.lineItems.map((line, index) => {
    const expenseAccountId = normalizeOptional(line.expenseAccountId) ?? vendor.defaultExpenseAccountId;
    const totals = calculateLineTotals({
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      taxCents: line.taxCents
    });
    return {
      id: accountsPayableId("rbl"),
      tenantId: parsed.data.tenantId,
      recurringBillTemplateId: templateId,
      expenseAccountId,
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
      "accounts-payable.RECURRING_BILL_TOTAL_MISMATCH",
      `${totalCheck.field} must equal computed line total.`,
      deps,
      [totalCheck]
    );
  }

  const template: RecurringBillTemplate = {
    id: templateId,
    tenantId: parsed.data.tenantId,
    name: parsed.data.name.trim(),
    vendorId: parsed.data.vendorId,
    frequency: parsed.data.frequency,
    customDays: parsed.data.customDays ?? null,
    status: "active",
    currency: normalizeCurrency(parsed.data.currency),
    paymentTermsDays: parsed.data.paymentTermsDays,
    nextBillDate: nextRecurringBillDate(parsed.data.startDate, parsed.data.frequency, parsed.data.customDays, null),
    lastBillDate: null,
    maxOccurrences: parsed.data.maxOccurrences ?? null,
    billsGenerated: 0,
    memo: parsed.data.memo ?? null,
    autoMarkPayable: parsed.data.autoMarkPayable,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    createdById: deps.actor?.id ?? null,
    createdAt: now,
    updatedAt: now
  };

  await deps.accountsPayableStore.insertRecurringBillTemplate(template, lineItems);
  const event: AccountsPayableEvent = {
    eventName: "accounts-payable.recurring_bill_template_created",
    entityType: "accounts-payable",
    entityId: template.id,
    tenantId: template.tenantId,
    payload: { vendorId: template.vendorId, totalCents: template.totalCents, frequency: template.frequency }
  };
  await deps.accountsPayableStore.writeEvent(event);

  return ok(201, { template: { ...template, lineItems }, event }, deps);
}
