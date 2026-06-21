import { ok, err, enforceScope } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import { invoiceMeta } from "../meta";
import { listInvoices } from "./list-invoices";
import { issueInvoice } from "./issue-invoice";
import { recordPayment } from "./record-payment";
import { createInvoicePaymentLink } from "./create-invoice-payment-link";
import { createRecurringInvoiceTemplate } from "./create-recurring-invoice-template";
import { generateDueRecurringInvoices } from "./generate-due-recurring-invoices";
import { listRecurringInvoiceTemplates } from "./list-recurring-invoice-templates";
import { updateRecurringInvoiceTemplateStatus } from "./update-recurring-invoice-template-status";
import { voidInvoice } from "./void-invoice";
import { addLineItem } from "./add-line-item";
import type { InvoiceStore, RecurringInvoiceStore } from "../ports";

// Enforced-authorization wrappers (plans/33, L1). These are the boundary the app
// should call instead of the raw use-cases: the tenant comes from the server-
// resolved AuthContext, never from caller input, and an invoice reached by id
// must resolve WITHIN that scope before any read or mutation. Additive strangler
// — the wrapped use-cases are unchanged. See the leak test in invoice.scope.test.ts.

type ScopeDeps = { invoiceStore: InvoiceStore; correlationId?: string; now?: () => number };
type RecurringScopeDeps = { recurringInvoiceStore: RecurringInvoiceStore; correlationId?: string; now?: () => number };

// A non-empty org scope must be present, else the call is refused (403) rather
// than run against an unknown tenant.
function requireScope(ctx: AuthContext | undefined, deps: { correlationId?: string; now?: () => number }) {
  if (!ctx || typeof ctx.orgId !== "string" || ctx.orgId.length === 0) {
    return err(
      403,
      { code: "invoice.SCOPE_REQUIRED", message: "An authenticated org scope is required." },
      invoiceMeta(deps)
    );
  }
  return null;
}

// The invoice must exist AND belong to the active org. A foreign or missing id is
// reported 404 (no cross-tenant existence disclosure). Returns null when owned.
async function ensureOwned(ctx: AuthContext, invoiceId: string, deps: ScopeDeps) {
  const invoice = await deps.invoiceStore.get(invoiceId);
  if (!invoice || !enforceScope(ctx, invoice.tenantId, { assert: false })) {
    return err(404, { code: "invoice.INVOICE_NOT_FOUND", message: "Invoice not found." }, invoiceMeta(deps));
  }
  return null;
}

function readInvoiceId(input: unknown): string | null {
  if (input && typeof input === "object") {
    const v = (input as Record<string, unknown>).invoiceId;
    if (typeof v === "string") return v;
  }
  return null;
}

function readTemplateId(input: unknown): string | null {
  if (input && typeof input === "object") {
    const v = (input as Record<string, unknown>).templateId;
    if (typeof v === "string") return v;
  }
  return null;
}

// List the active org's invoices. Any tenantId on `input` is overridden with the
// session's org so a forged value can never widen scope.
export async function listInvoicesScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof listInvoices>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return listInvoices({ ...base, tenantId: ctx.orgId }, deps);
}

// Read one invoice with its line items, only if it belongs to the active org.
export async function getInvoiceScoped(ctx: AuthContext, invoiceId: string, deps: ScopeDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const meta = invoiceMeta(deps);
  const invoice = await deps.invoiceStore.get(invoiceId);
  if (!invoice || !enforceScope(ctx, invoice.tenantId, { assert: false })) {
    return err(404, { code: "invoice.INVOICE_NOT_FOUND", message: "Invoice not found." }, meta);
  }
  const lineItems = await deps.invoiceStore.listLineItems(invoiceId);
  return ok(200, { invoice, lineItems }, meta);
}

// Mutating wrappers: ownership is enforced BEFORE delegating, so a cross-tenant
// issue/payment/void/edit is impossible.
export async function issueInvoiceScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof issueInvoice>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const id = readInvoiceId(input);
  if (id) {
    const bad = await ensureOwned(ctx, id, deps);
    if (bad) return bad;
  }
  return issueInvoice(input, deps);
}

export async function recordPaymentScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof recordPayment>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const id = readInvoiceId(input);
  if (id) {
    const bad = await ensureOwned(ctx, id, deps);
    if (bad) return bad;
  }
  return recordPayment(input, deps);
}

export async function createInvoicePaymentLinkScoped(
  ctx: AuthContext,
  input: unknown,
  deps: Parameters<typeof createInvoicePaymentLink>[1]
) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const id = readInvoiceId(input);
  if (id) {
    const bad = await ensureOwned(ctx, id, deps);
    if (bad) return bad;
  }
  return createInvoicePaymentLink(input, deps);
}

export async function createRecurringInvoiceTemplateScoped(
  ctx: AuthContext,
  input: unknown,
  deps: Parameters<typeof createRecurringInvoiceTemplate>[1]
) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return createRecurringInvoiceTemplate({ ...base, tenantId: ctx.orgId }, deps);
}

export async function listRecurringInvoiceTemplatesScoped(
  ctx: AuthContext,
  input: unknown,
  deps: Parameters<typeof listRecurringInvoiceTemplates>[1]
) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return listRecurringInvoiceTemplates({ ...base, tenantId: ctx.orgId }, deps);
}

async function ensureTemplateOwned(ctx: AuthContext, templateId: string, deps: RecurringScopeDeps) {
  const template = await deps.recurringInvoiceStore.getTemplate(ctx.orgId, templateId);
  if (!template) {
    return err(404, { code: "invoice.RECURRING_TEMPLATE_NOT_FOUND", message: "Recurring invoice template not found." }, invoiceMeta(deps));
  }
  return null;
}

export async function updateRecurringInvoiceTemplateStatusScoped(
  ctx: AuthContext,
  input: unknown,
  deps: Parameters<typeof updateRecurringInvoiceTemplateStatus>[1]
) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const id = readTemplateId(input);
  if (id) {
    const bad = await ensureTemplateOwned(ctx, id, deps);
    if (bad) return bad;
  }
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return updateRecurringInvoiceTemplateStatus({ ...base, tenantId: ctx.orgId }, deps);
}

export async function generateDueRecurringInvoicesScoped(
  ctx: AuthContext,
  input: unknown,
  deps: Parameters<typeof generateDueRecurringInvoices>[1]
) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return generateDueRecurringInvoices({ ...base, tenantId: ctx.orgId }, deps);
}

export async function voidInvoiceScoped(ctx: AuthContext, invoiceId: string, deps: Parameters<typeof voidInvoice>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const bad = await ensureOwned(ctx, invoiceId, deps);
  if (bad) return bad;
  return voidInvoice(invoiceId, deps);
}

export async function addLineItemScoped(
  ctx: AuthContext,
  invoiceId: string,
  input: unknown,
  deps: Parameters<typeof addLineItem>[2]
) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const bad = await ensureOwned(ctx, invoiceId, deps);
  if (bad) return bad;
  return addLineItem(invoiceId, input, deps);
}
