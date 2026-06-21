import { ok, err } from "@microservices-sh/connection-contract";
import { invoiceMeta } from "../meta";
import { listRecurringInvoiceTemplatesInputSchema } from "../schemas";
import type { RecurringInvoiceStore } from "../ports";

export async function listRecurringInvoiceTemplates(
  input: unknown,
  deps: { recurringInvoiceStore: RecurringInvoiceStore; now?: () => number; correlationId?: string }
) {
  const meta = invoiceMeta(deps);
  const parsed = listRecurringInvoiceTemplatesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "invoice.INVALID_RECURRING_TEMPLATE_FILTER", message: "Recurring invoice filter is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const templates = await deps.recurringInvoiceStore.listTemplates(parsed.data);
  return ok(200, { templates, count: templates.length }, meta);
}
