import { ok } from "@microservices-sh/connection-contract";
import { invoiceMeta } from "../meta";
import type { InvoiceStore } from "../ports";

// Dunning source: open invoices past their due date. Run on a jobs-workflows
// schedule and enqueue a reminder job per result (idempotency keyed on
// invoice id + reminder date so a customer is not emailed twice for one day).
export async function dueForReminder(deps: {
  invoiceStore: InvoiceStore;
  now?: () => number;
  limit?: number;
  correlationId?: string;
}) {
  const meta = invoiceMeta(deps);
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const invoices = await deps.invoiceStore.listOverdue(nowIso, deps.limit ?? 100);
  return ok(200, { invoices, count: invoices.length }, meta);
}
