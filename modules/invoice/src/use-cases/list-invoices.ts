import { ok, err } from "@microservices-sh/connection-contract";
import { listInvoicesFilterSchema } from "../schemas";
import { invoiceMeta } from "../meta";
import type { InvoiceStore } from "../ports";

// Tenant-scoped listing, optionally by customer and status.
export async function listInvoices(
  input: unknown,
  deps: { invoiceStore: InvoiceStore; correlationId?: string; now?: () => number }
) {
  const meta = invoiceMeta(deps);

  const parsed = listInvoicesFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "invoice.INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues },
      meta
    );
  }
  const invoices = await deps.invoiceStore.list(parsed.data);
  return ok(200, { invoices, count: invoices.length }, meta);
}
