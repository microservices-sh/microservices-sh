import { ok, err } from "@microservices-sh/connection-contract";
import { invoiceMeta } from "../meta";
import { generateDueRecurringInvoicesInputSchema } from "../schemas";
import type { InvoiceStore, NumberAllocator, RecurringInvoiceStore } from "../ports";
import type { DomainEvent, Invoice, RecurringInvoiceTemplateWithLineItems } from "../types";
import { createInvoice } from "./create-invoice";
import { issueInvoice } from "./issue-invoice";
import { nextRecurringInvoiceDate } from "./recurring-date";

function shouldCompleteAfterOccurrence(template: RecurringInvoiceTemplateWithLineItems, nextInvoiceAt: string | null) {
  if (template.maxOccurrences !== null && template.invoicesGenerated + 1 >= template.maxOccurrences) return true;
  if (template.endAt && nextInvoiceAt && nextInvoiceAt > template.endAt) return true;
  return false;
}

function advanceTemplate(template: RecurringInvoiceTemplateWithLineItems, occurrenceAt: string, nowIso: string) {
  const next = nextRecurringInvoiceDate(occurrenceAt, template.frequency, template.customDays);
  const completed = shouldCompleteAfterOccurrence(template, next);
  return {
    ...template,
    status: completed ? "completed" : template.status,
    nextInvoiceAt: completed ? null : next,
    lastInvoiceAt: occurrenceAt,
    invoicesGenerated: template.invoicesGenerated + 1,
    updatedAt: nowIso
  };
}

async function maybeIssueGeneratedInvoice(
  invoice: Invoice,
  template: RecurringInvoiceTemplateWithLineItems,
  deps: {
    invoiceStore: InvoiceStore;
    allocator: NumberAllocator;
    now?: () => number;
    correlationId?: string;
  }
) {
  if (!template.autoIssue || invoice.status !== "draft") return invoice;
  const issued = await issueInvoice(
    { invoiceId: invoice.id, termsDays: template.paymentTermsDays },
    { invoiceStore: deps.invoiceStore, allocator: deps.allocator, now: deps.now, correlationId: deps.correlationId }
  );
  if (!issued.ok) return issued;
  return (await deps.invoiceStore.get(invoice.id)) ?? invoice;
}

export async function generateDueRecurringInvoices(
  input: unknown,
  deps: {
    invoiceStore: InvoiceStore;
    recurringInvoiceStore: RecurringInvoiceStore;
    allocator: NumberAllocator;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = invoiceMeta(deps);
  const parsed = generateDueRecurringInvoicesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "invoice.INVALID_RECURRING_GENERATION_INPUT",
        message: "Recurring invoice generation input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const asOfDate = parsed.data.asOfDate ?? new Date(deps.now?.() ?? Date.now()).toISOString();
  const templates = await deps.recurringInvoiceStore.listTemplates({
    tenantId: parsed.data.tenantId,
    status: "active",
    dueOnOrBefore: asOfDate,
    limit: parsed.data.limit
  });

  const invoices: Invoice[] = [];
  const events: DomainEvent[] = [];
  let createdCount = 0;
  let dedupedCount = 0;

  for (const template of templates) {
    if (!template.nextInvoiceAt) continue;
    if (template.maxOccurrences !== null && template.invoicesGenerated >= template.maxOccurrences) {
      await deps.recurringInvoiceStore.updateTemplate({
        ...template,
        status: "completed",
        nextInvoiceAt: null,
        updatedAt: asOfDate
      });
      continue;
    }
    if (template.endAt && template.nextInvoiceAt > template.endAt) {
      await deps.recurringInvoiceStore.updateTemplate({
        ...template,
        status: "completed",
        nextInvoiceAt: null,
        updatedAt: asOfDate
      });
      continue;
    }

    const occurrenceAt = template.nextInvoiceAt;
    let deduped = false;
    let invoice = await deps.invoiceStore.findByRecurringOccurrence(template.tenantId, template.id, occurrenceAt);

    if (invoice) {
      deduped = true;
      dedupedCount += 1;
    } else {
      try {
        const created = await createInvoice(
          {
            tenantId: template.tenantId,
            customerId: template.customerId,
            currency: template.currency,
            series: template.series,
            notes: template.notes,
            recurringTemplateId: template.id,
            recurringOccurrenceAt: occurrenceAt,
            lineItems: template.lineItems.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitAmountCents: line.unitAmountCents,
              taxRateBps: line.taxRateBps
            }))
          },
          { invoiceStore: deps.invoiceStore, now: deps.now, correlationId: deps.correlationId }
        );
        if (!created.ok) return created;
        invoice = await deps.invoiceStore.get(created.data.id);
        if (!invoice) {
          return err(500, { code: "invoice.RECURRING_INVOICE_CREATE_FAILED", message: "Generated invoice could not be loaded." }, meta);
        }
        createdCount += 1;
      } catch (error) {
        const existing = await deps.invoiceStore.findByRecurringOccurrence(template.tenantId, template.id, occurrenceAt);
        if (!existing) throw error;
        invoice = existing;
        deduped = true;
        dedupedCount += 1;
      }
    }

    const maybeIssued = await maybeIssueGeneratedInvoice(invoice, template, deps);
    if ("ok" in maybeIssued && maybeIssued.ok === false) return maybeIssued;
    invoice = maybeIssued as Invoice;
    invoices.push(invoice);

    const updated = advanceTemplate(template, occurrenceAt, asOfDate);
    await deps.recurringInvoiceStore.updateTemplate(updated);
    events.push({
      name: "invoice.recurring_invoice_generated",
      correlationId: meta.correlationId,
      payload: {
        templateId: template.id,
        invoiceId: invoice.id,
        occurrenceAt,
        completed: updated.status === "completed",
        deduped
      }
    });
  }

  return ok(
    createdCount > 0 ? 201 : 200,
    { invoices, count: invoices.length, createdCount, dedupedCount, asOfDate, events },
    meta
  );
}
