import type { InvoiceStore } from "../ports";

// Dunning source: open invoices past their due date. Run on a jobs-workflows
// schedule and enqueue a reminder job per result (idempotency keyed on
// invoice id + reminder date so a customer is not emailed twice for one day).
export async function dueForReminder(deps: { invoiceStore: InvoiceStore; now?: () => number; limit?: number }) {
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const invoices = await deps.invoiceStore.listOverdue(nowIso, deps.limit ?? 100);
  return { ok: true as const, status: 200 as const, data: { invoices, count: invoices.length } };
}
