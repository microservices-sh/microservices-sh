import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createInvoice, getInvoiceScoped, issueInvoiceScoped, authContext } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { syncInvoiceToReceivables } from "$lib/server/accounts-receivable-sync";

interface LineRow {
  description: string;
  quantity: number;
  unitAmountCents: number;
  taxRateBps: number;
}

// Parse the editor's line-item payload defensively — amounts arrive already in
// minor units (cents) and tax already in basis points. Drop malformed rows
// rather than failing the whole submit.
function parseLineItems(raw: string): LineRow[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is LineRow =>
          !!r &&
          typeof (r as LineRow).description === "string" &&
          (r as LineRow).description.trim().length > 0 &&
          Number.isFinite((r as LineRow).unitAmountCents)
      )
      .map((r) => ({
        description: r.description.trim().slice(0, 500),
        quantity: Number.isInteger(r.quantity) && r.quantity > 0 ? r.quantity : 1,
        unitAmountCents: Math.trunc(r.unitAmountCents),
        taxRateBps: Number.isFinite(r.taxRateBps) ? Math.min(100_000, Math.max(0, Math.trunc(r.taxRateBps))) : 0
      }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("invoice", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Issuing invoices requires member.manage; gate the page itself, not just the action.
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

  const customersResult = await listCustomers({ customerRepository: locals.customerRepository });
  return {
    customers: customersResult.data.customers.map((c) => ({ id: c.id, name: c.name }))
  };
};

export const actions: Actions = {
  // Create a draft with its line items and issue it in one step: drafts are an
  // internal staging state, so the ERP's "New invoice" simply issues. Numbers
  // are allocated atomically by the module's NumberAllocator at issue time. On
  // success we redirect back to the ledger with the new number for a flash.
  default: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-receivable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });

    const form = await request.formData();
    const customerId = String(form.get("customerId") ?? "").trim();
    const currency = (String(form.get("currency") ?? "USD").trim() || "USD").toUpperCase().slice(0, 3);
    const termsDaysRaw = Number(form.get("termsDays"));
    const termsDays = Number.isFinite(termsDaysRaw) ? Math.min(365, Math.max(0, Math.trunc(termsDaysRaw))) : 14;
    const lineItems = parseLineItems(String(form.get("lineItems") ?? "[]"));

    if (!customerId) return fail(400, { error: "Choose a customer for the invoice." });
    if (lineItems.length === 0) {
      return fail(400, { error: "Add at least one line item with a description and amount." });
    }

    const draft = await createInvoice(
      { tenantId: activeOrgId, customerId, currency, lineItems },
      { invoiceStore: locals.invoiceStore }
    );
    if (!draft.ok || !draft.data) {
      return fail(draft.status ?? 400, { error: draft.error?.message ?? "Could not create the invoice." });
    }

    const issued = await issueInvoiceScoped(
      ctx,
      { invoiceId: draft.data.id, termsDays },
      { invoiceStore: locals.invoiceStore, allocator: locals.numberAllocator }
    );
    if (!issued.ok || !issued.data) {
      return fail(issued.status ?? 400, { error: issued.error?.message ?? "Could not issue the invoice." });
    }

    const invoiceSnapshot = await getInvoiceScoped(ctx, draft.data.id, { invoiceStore: locals.invoiceStore });
    if (!invoiceSnapshot.ok || !invoiceSnapshot.data) {
      return fail(invoiceSnapshot.status ?? 400, { error: invoiceSnapshot.error?.message ?? "Could not load the issued invoice." });
    }
    const synced = await syncInvoiceToReceivables({
      accountsReceivableService: locals.accountsReceivableService,
      tenantId: activeOrgId,
      actorId: locals.user.id,
      invoice: invoiceSnapshot.data.invoice
    });

    await recordEvent(
      {
        eventName: "invoice.issued",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: draft.data.id,
        source: "app/invoices/new",
        payload: {
          number: issued.data.number,
          customerId,
          receivablesSynced: synced.ok,
          receivablesSyncError: synced.ok ? null : synced.message
        }
      },
      { auditStore: locals.auditStore }
    );

    throw redirect(303, `/app/invoices?issued=${encodeURIComponent(issued.data.number ?? "")}`);
  }
};
