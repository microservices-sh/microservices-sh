import { ok, err } from "@microservices-sh/connection-contract";
import { invoiceMeta } from "../meta";
import { createRecurringInvoiceTemplateInputSchema } from "../schemas";
import { computeTotals, lineAmountCents } from "../totals";
import type { RecurringInvoiceStore } from "../ports";
import type { DomainEvent, RecurringInvoiceTemplate, RecurringInvoiceTemplateLineItem } from "../types";

export async function createRecurringInvoiceTemplate(
  input: unknown,
  deps: { recurringInvoiceStore: RecurringInvoiceStore; now?: () => number; correlationId?: string }
) {
  const meta = invoiceMeta(deps);
  const parsed = createRecurringInvoiceTemplateInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "invoice.INVALID_RECURRING_TEMPLATE_INPUT",
        message: "Recurring invoice template input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const templateId = "rit_" + crypto.randomUUID().slice(0, 16);
  const lineItems: RecurringInvoiceTemplateLineItem[] = parsed.data.lineItems.map((line, index) => ({
    id: "ritli_" + crypto.randomUUID().slice(0, 16),
    templateId,
    description: line.description.trim(),
    quantity: line.quantity,
    unitAmountCents: line.unitAmountCents,
    taxRateBps: line.taxRateBps,
    amountCents: lineAmountCents(line.quantity, line.unitAmountCents),
    sortOrder: index,
    createdAt: nowIso,
    updatedAt: nowIso
  }));
  const totals = computeTotals(lineItems);
  const template: RecurringInvoiceTemplate = {
    id: templateId,
    tenantId: parsed.data.tenantId,
    customerId: parsed.data.customerId,
    name: parsed.data.name.trim(),
    series: parsed.data.series,
    currency: parsed.data.currency.toUpperCase(),
    frequency: parsed.data.frequency,
    customDays: parsed.data.customDays ?? null,
    status: "active",
    startAt: parsed.data.startAt,
    endAt: parsed.data.endAt ?? null,
    nextInvoiceAt: parsed.data.startAt,
    lastInvoiceAt: null,
    paymentTermsDays: parsed.data.paymentTermsDays,
    maxOccurrences: parsed.data.maxOccurrences ?? null,
    invoicesGenerated: 0,
    autoIssue: parsed.data.autoIssue,
    notes: parsed.data.notes ?? null,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await deps.recurringInvoiceStore.insertTemplate(template, lineItems);
  const event: DomainEvent = {
    name: "invoice.recurring_template_created",
    correlationId: meta.correlationId,
    payload: {
      id: template.id,
      customerId: template.customerId,
      totalCents: template.totalCents,
      frequency: template.frequency,
      nextInvoiceAt: template.nextInvoiceAt
    }
  };

  return ok(201, { template: { ...template, lineItems }, event }, meta);
}
