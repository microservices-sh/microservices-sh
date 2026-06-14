import { listInvoicesFilterSchema } from "../schemas";
import type { InvoiceStore } from "../ports";

// Tenant-scoped listing, optionally by customer and status.
export async function listInvoices(input: unknown, deps: { invoiceStore: InvoiceStore }) {
  const parsed = listInvoicesFilterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }
    };
  }
  const invoices = await deps.invoiceStore.list(parsed.data);
  return { ok: true as const, status: 200 as const, data: { invoices, count: invoices.length } };
}
