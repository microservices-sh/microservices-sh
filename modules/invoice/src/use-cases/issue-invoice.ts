import { defaultConfig } from "../config";
import { beforeInvoiceIssue, onInvoiceIssued } from "../hooks";
import { issueInvoiceInputSchema } from "../schemas";
import type { InvoiceStore, NumberAllocator } from "../ports";

// Issue a draft: assign a gapless number via the atomic allocator, freeze totals,
// set due date, and move to "open". The allocator is the reason this module
// exists — MAX(number)+1 in app code double-assigns under concurrency. The
// abort hook runs BEFORE allocation so a rejected issue never wastes a number.
export async function issueInvoice(
  input: unknown,
  deps: {
    invoiceStore: InvoiceStore;
    allocator: NumberAllocator;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
  }
) {
  const parsed = issueInvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_ISSUE_INPUT", message: "Issue input is invalid.", issues: parsed.error.issues }
    };
  }

  const invoice = await deps.invoiceStore.get(parsed.data.invoiceId);
  if (!invoice) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "INVOICE_NOT_FOUND", message: "Invoice not found." } };
  }
  // Idempotent: re-issuing an already-open/paid invoice returns the existing number.
  if (invoice.status === "open" || invoice.status === "paid") {
    return { ok: true as const, status: 200 as const, data: { id: invoice.id, number: invoice.number, status: invoice.status, alreadyIssued: true } };
  }
  if (invoice.status === "void") {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "INVOICE_VOID", message: "A void invoice cannot be issued." } };
  }

  const items = await deps.invoiceStore.listLineItems(invoice.id);
  if (items.length === 0) {
    return { ok: false as const, status: 422 as const, data: null, error: { code: "EMPTY_INVOICE", message: "Cannot issue an invoice with no line items." } };
  }

  const aborted = (await beforeInvoiceIssue(invoice)) === null;
  if (aborted) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "ISSUE_ABORTED", message: "Issue was aborted by beforeInvoiceIssue." } };
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const seq = await deps.allocator.allocate(invoice.series);
  const number = `${invoice.series}-${String(seq).padStart(cfg.numberPadWidth, "0")}`;

  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  invoice.number = number;
  invoice.status = "open";
  invoice.issuedAt = nowIso;
  invoice.dueAt = new Date(nowMs + parsed.data.termsDays * 86_400_000).toISOString();
  invoice.updatedAt = nowIso;
  await deps.invoiceStore.update(invoice);

  await onInvoiceIssued(invoice);

  return { ok: true as const, status: 201 as const, data: { id: invoice.id, number, status: "open" as const, dueAt: invoice.dueAt } };
}
