import { generateDueRecurringInvoices } from "@microservices-sh/invoice";
import type { AccountingCoreStore, Actor } from "@microservices-sh/accounting-core";
import type { AccountsReceivableService } from "@microservices-sh/accounts-receivable";
import type { InvoiceStore, NumberAllocator, RecurringInvoiceStore } from "@microservices-sh/invoice/ports";
import type { JobHandler } from "@microservices-sh/jobs-workflows";
import { postIssuedInvoiceToAccounting } from "./accounts-receivable-accounting";
import { syncInvoiceToReceivables } from "./accounts-receivable-sync";

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
  accountingCoreStore?: AccountingCoreStore;
  accountsReceivableService?: AccountsReceivableService;
  actor?: Actor | null;
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
      if (deps.accountingCoreStore && deps.accountsReceivableService) {
        const actor = deps.actor ?? { id: "system:recurring-invoice-job", permissions: ["member.manage"] };
        for (const invoice of result.data.invoices) {
          if (invoice.status === "draft") continue;
          try {
            await postIssuedInvoiceToAccounting({
              accountingCoreStore: deps.accountingCoreStore,
              actor,
              invoice
            });
            const synced = await syncInvoiceToReceivables({
              accountsReceivableService: deps.accountsReceivableService,
              tenantId,
              actorId: actor.id,
              invoice
            });
            if (!synced.ok) return { ok: false, error: synced.message };
          } catch (error) {
            return {
              ok: false,
              error: error instanceof Error ? error.message : "Could not post generated recurring invoice to accounting."
            };
          }
        }
      }
      return { ok: true };
    }
  };
}
