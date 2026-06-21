import { generateDueRecurringInvoices } from "@microservices-sh/invoice";
import type { InvoiceStore, NumberAllocator, RecurringInvoiceStore } from "@microservices-sh/invoice/ports";
import type { JobHandler } from "@microservices-sh/jobs-workflows";

export const RECURRING_INVOICE_GENERATE_DUE_JOB_TYPE = "invoice.recurring.generate_due";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalLimit(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export function createRecurringInvoiceJobHandlers(deps: {
  invoiceStore: InvoiceStore;
  recurringInvoiceStore: RecurringInvoiceStore;
  allocator: NumberAllocator;
  now?: () => number;
}): Record<string, JobHandler> {
  return {
    [RECURRING_INVOICE_GENERATE_DUE_JOB_TYPE]: async (payload) => {
      const tenantId = optionalString(payload.tenantId);
      if (!tenantId) return { ok: false, error: "payload.tenantId is required." };

      const result = await generateDueRecurringInvoices(
        {
          tenantId,
          asOfDate: optionalString(payload.asOfDate),
          limit: optionalLimit(payload.limit)
        },
        deps
      );
      if (!result.ok) return { ok: false, error: result.error?.message ?? "Could not generate recurring invoices." };
      return { ok: true };
    }
  };
}
