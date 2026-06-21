import { generateDueRecurringBillsInputSchema } from "../schemas";
import { nextRecurringBillDate } from "../service";
import type { BillWithLineItems, RecurringBillTemplateWithLineItems } from "../types";
import { createBill } from "./create-bill";
import { markBillPayable } from "./mark-bill-payable";
import { err, ok, type AccountsPayableDeps } from "./shared";

function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function occurrenceBillNumber(template: RecurringBillTemplateWithLineItems): string {
  const shortId = template.id.replace(/^rbt_/, "").slice(0, 8).toUpperCase();
  const yyyymmdd = template.nextBillDate.slice(0, 10).replaceAll("-", "");
  return `RB-${shortId}-${yyyymmdd}`;
}

function advanceTemplate(
  template: RecurringBillTemplateWithLineItems,
  asOfDate: string
): { updated: RecurringBillTemplateWithLineItems; completed: boolean } {
  const billsGenerated = template.billsGenerated + 1;
  const completed = template.maxOccurrences !== null && billsGenerated >= template.maxOccurrences;
  return {
    updated: {
      ...template,
      status: completed ? "completed" : template.status,
      lastBillDate: template.nextBillDate,
      nextBillDate: nextRecurringBillDate(template.nextBillDate, template.frequency, template.customDays, null),
      billsGenerated,
      updatedAt: asOfDate
    },
    completed
  };
}

export async function generateDueRecurringBills(input: unknown, deps: AccountsPayableDeps) {
  const parsed = generateDueRecurringBillsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "accounts-payable.INVALID_RECURRING_BILL_GENERATION_INPUT",
      "Recurring bill generation input is invalid.",
      deps,
      parsed.error.issues
    );
  }

  const asOfDate = parsed.data.asOfDate ?? new Date(deps.now ? deps.now() : Date.now()).toISOString();
  const templates = await deps.accountsPayableStore.listRecurringBillTemplates({
    tenantId: parsed.data.tenantId,
    status: "active",
    dueOnOrBefore: asOfDate,
    limit: parsed.data.limit
  });

  const generated: BillWithLineItems[] = [];
  let createdCount = 0;
  let dedupedCount = 0;
  for (const template of templates) {
    if (template.maxOccurrences !== null && template.billsGenerated >= template.maxOccurrences) {
      await deps.accountsPayableStore.updateRecurringBillTemplate({
        ...template,
        status: "completed",
        updatedAt: asOfDate
      });
      continue;
    }

    let deduped = false;
    let bill = await deps.accountsPayableStore.findBillByRecurringOccurrence(
      template.tenantId,
      template.id,
      template.nextBillDate
    );

    if (bill) {
      deduped = true;
      dedupedCount += 1;
    } else {
      try {
        const created = await createBill(
          {
            tenantId: template.tenantId,
            vendorId: template.vendorId,
            billNumber: occurrenceBillNumber(template),
            billDate: template.nextBillDate,
            dueDate: addDaysIso(template.nextBillDate, template.paymentTermsDays),
            currency: template.currency,
            memo: template.memo,
            recurringTemplateId: template.id,
            lineItems: template.lineItems.map((line) => ({
              expenseAccountId: line.expenseAccountId,
              description: line.description,
              quantity: line.quantity,
              unitAmountCents: line.unitAmountCents,
              taxCents: line.taxCents
            }))
          },
          deps
        );
        if (!created.ok) return created;
        bill = created.data.bill;
        createdCount += 1;
      } catch (error) {
        const existing = await deps.accountsPayableStore.findBillByRecurringOccurrence(
          template.tenantId,
          template.id,
          template.nextBillDate
        );
        if (!existing) throw error;
        bill = existing;
        deduped = true;
        dedupedCount += 1;
      }
    }

    if (
      template.autoMarkPayable &&
      (bill.status === "draft" || bill.status === "pending_approval" || bill.status === "payable")
    ) {
      const payable = await markBillPayable(
        {
          tenantId: bill.tenantId,
          billId: bill.id,
          postToAccounting: parsed.data.postToAccounting
        },
        deps
      );
      if (!payable.ok) return payable;
      bill = payable.data.bill;
    }
    generated.push(bill);

    const { updated, completed } = advanceTemplate(template, asOfDate);
    await deps.accountsPayableStore.updateRecurringBillTemplate(updated);
    await deps.accountsPayableStore.writeEvent({
      eventName: "accounts-payable.recurring_bill_generated",
      entityType: "accounts-payable",
      entityId: bill.id,
      tenantId: bill.tenantId,
      payload: {
        templateId: template.id,
        billId: bill.id,
        occurrenceDate: template.nextBillDate,
        completed,
        deduped
      }
    });
  }

  return ok(
    createdCount > 0 ? 201 : 200,
    { bills: generated, count: generated.length, createdCount, dedupedCount, asOfDate },
    deps
  );
}
