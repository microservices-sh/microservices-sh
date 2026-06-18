import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listInvoices, createInvoice, issueInvoice, recordPayment } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

interface LineRow {
  description: string;
  quantity: number;
  unitAmountCents: number;
  taxRateBps: number;
}

// Parse the form's line-item payload defensively — amounts arrive already in
// minor units (cents) and tax already in basis points from the client editor.
// Drop malformed rows rather than failing the whole submit.
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

  // Read gate: org.read lets an employee view the invoice ledger.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  // Invoices are scoped to the single company org; its id is the tenant.
  const [invoicesResult, customersResult] = await Promise.all([
    listInvoices({ tenantId: activeOrgId }, { invoiceStore: locals.invoiceStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const customers = customersResult.data.customers;
  const nameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number ?? "—",
      status: invoice.status,
      customer: nameById.get(invoice.customerId) ?? invoice.customerId,
      currency: invoice.currency,
      totalCents: invoice.totalCents,
      outstandingCents: invoice.totalCents - invoice.amountPaidCents
    }))
  };
};

export const actions: Actions = {
  // Create a draft with its line items and issue it in one step: drafts are an
  // internal staging state, so the ERP's "New invoice" simply issues. Numbers
  // are allocated atomically by the module's NumberAllocator at issue time.
  create: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a company." });

    // Write gate: issuing invoices requires member.manage in the company org.
    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

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

    const issued = await issueInvoice(
      { invoiceId: draft.data.id, termsDays },
      { invoiceStore: locals.invoiceStore, allocator: locals.numberAllocator }
    );
    if (!issued.ok || !issued.data) {
      return fail(issued.status ?? 400, { error: issued.error?.message ?? "Could not issue the invoice." });
    }

    await recordEvent(
      {
        eventName: "invoice.issued",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: draft.data.id,
        source: "app/invoices",
        payload: { number: issued.data.number, customerId }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, number: issued.data.number };
  },

  // Record a payment against an open invoice. The module flips status to "paid"
  // once the balance is fully covered (and emits invoice.paid), so a full-amount
  // payment marks it settled and drops it out of "Outstanding" on the dashboard.
  payment: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a company." });

    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const invoiceId = String(form.get("invoiceId") ?? "").trim();
    const amount = Number(form.get("amount"));
    const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;

    if (!invoiceId) return fail(400, { error: "Missing invoice." });
    if (amountCents <= 0) return fail(400, { error: "Enter a payment amount greater than zero." });

    const result = await recordPayment({ invoiceId, amountCents }, { invoiceStore: locals.invoiceStore });
    if (!result.ok || !result.data) {
      return fail(result.status ?? 400, { error: result.error?.message ?? "Could not record the payment." });
    }

    await recordEvent(
      {
        eventName: "invoice.payment_recorded",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: invoiceId,
        source: "app/invoices",
        payload: { amountCents, status: result.data.status }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, paymentRecorded: true, paid: result.data.status === "paid" };
  }
};
