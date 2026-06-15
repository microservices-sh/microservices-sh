import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { beforeInvoiceIssue, onInvoiceIssued } from "../hooks";
import { issueInvoiceInputSchema } from "../schemas";
import { invoiceMeta } from "../meta";
import type { InvoiceStore, NumberAllocator } from "../ports";
import type { DomainEvent, Invoice } from "../types";

// Issue a draft: assign a gapless number via the atomic allocator, freeze totals,
// set due date, and move to "open". The allocator is the reason this module
// exists — MAX(number)+1 in app code double-assigns under concurrency. The
// abort hook runs BEFORE allocation so a rejected issue never wastes a number.
//
// Two customization layers run before allocation (Plan 25 §5):
//   1. the local config seam `beforeInvoiceIssue` (per-app override; null aborts)
//   2. the cross-module `beforeInvoiceIssue` hook chain, injected by the composed
//      app via deps.beforeIssueHooks — filters may mutate, guards may veto.
export async function issueInvoice(
  input: unknown,
  deps: {
    invoiceStore: InvoiceStore;
    allocator: NumberAllocator;
    now?: () => number;
    correlationId?: string;
    config?: Partial<typeof defaultConfig>;
    beforeIssueHooks?: ResolvedHook<Invoice>[];
    onIssuedHooks?: ResolvedHook<Invoice>[];
  }
) {
  const meta = invoiceMeta(deps);

  const parsed = issueInvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "invoice.INVALID_ISSUE_INPUT", message: "Issue input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const invoice = await deps.invoiceStore.get(parsed.data.invoiceId);
  if (!invoice) {
    return err(404, { code: "invoice.INVOICE_NOT_FOUND", message: "Invoice not found." }, meta);
  }
  // Idempotent: re-issuing an already-open/paid invoice returns the existing number.
  if (invoice.status === "open" || invoice.status === "paid") {
    return ok(200, { id: invoice.id, number: invoice.number, status: invoice.status, alreadyIssued: true }, meta);
  }
  if (invoice.status === "void") {
    return err(409, { code: "invoice.INVOICE_VOID", message: "A void invoice cannot be issued." }, meta);
  }

  const items = await deps.invoiceStore.listLineItems(invoice.id);
  if (items.length === 0) {
    return err(422, { code: "invoice.EMPTY_INVOICE", message: "Cannot issue an invoice with no line items." }, meta);
  }

  // Local config seam: null aborts the issue before any number is allocated.
  const seamed = await beforeInvoiceIssue(invoice);
  if (seamed === null) {
    return err(409, { code: "invoice.ISSUE_ABORTED", message: "Issue was aborted by beforeInvoiceIssue." }, meta);
  }

  // Cross-module hook chain: filters may adjust, guards may veto.
  const hooked = await runHooks(
    "beforeInvoiceIssue",
    seamed,
    { correlationId: meta.correlationId },
    deps.beforeIssueHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
  }
  const ready = hooked.value;

  const cfg = { ...defaultConfig, ...deps.config };
  const seq = await deps.allocator.allocate(ready.series);
  const number = `${ready.series}-${String(seq).padStart(cfg.numberPadWidth, "0")}`;

  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  ready.number = number;
  ready.status = "open";
  ready.issuedAt = nowIso;
  ready.dueAt = new Date(nowMs + parsed.data.termsDays * 86_400_000).toISOString();
  ready.updatedAt = nowIso;
  await deps.invoiceStore.update(ready);

  // Local observer seam then cross-module observer chain (fire-and-forget).
  await onInvoiceIssued(ready);
  await runHooks("onInvoiceIssued", ready, { correlationId: meta.correlationId }, deps.onIssuedHooks ?? []);

  const event: DomainEvent = {
    name: "invoice.issued",
    correlationId: meta.correlationId,
    payload: { id: ready.id, number, customerId: ready.customerId, dueAt: ready.dueAt }
  };

  return ok(201, { id: ready.id, number, status: "open" as const, dueAt: ready.dueAt, event }, meta);
}
