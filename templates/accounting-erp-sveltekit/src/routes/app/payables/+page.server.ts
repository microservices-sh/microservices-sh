import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { createBill, createVendor, getAgingReport, listBills, listVendors } from "@microservices-sh/accounts-payable";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function cents(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function dateToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [vendorsResult, billsResult, agingResult] = await Promise.all([
    listVendors({ tenantId: activeOrgId, includeInactive: true, limit: 250 }, { accountsPayableStore: locals.accountsPayableStore }),
    listBills({ tenantId: activeOrgId, limit: 100 }, { accountsPayableStore: locals.accountsPayableStore }),
    getAgingReport({ tenantId: activeOrgId }, { accountsPayableStore: locals.accountsPayableStore })
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    vendors: vendorsResult.ok ? vendorsResult.data.vendors : [],
    bills: billsResult.ok ? billsResult.data.bills : [],
    aging: agingResult.ok ? agingResult.data.report : null
  };
};

export const actions: Actions = {
  createVendor: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      name: text(form.get("name")),
      email: text(form.get("email")),
      currency: text(form.get("currency")).toUpperCase() || "USD"
    };
    if (!values.name) return fail(400, { error: "Enter a vendor name.", values });

    const result = await createVendor(
      {
        tenantId: org.id,
        name: values.name,
        email: values.email || null,
        currency: values.currency,
        is1099Vendor: false,
        defaultPaymentTermsDays: 30
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.vendor_created",
        actorId: locals.user.id,
        entityType: "vendor",
        entityId: result.data.vendor.id,
        source: "app/payables",
        payload: { name: result.data.vendor.name }
      },
      { auditStore: locals.auditStore }
    );

    return { vendorCreated: true };
  },

  createBill: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      vendorId: text(form.get("vendorId")),
      billNumber: text(form.get("billNumber")),
      billDate: text(form.get("billDate")),
      dueDate: text(form.get("dueDate")),
      description: text(form.get("description")),
      quantity: text(form.get("quantity")),
      unitAmount: text(form.get("unitAmount")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      memo: text(form.get("memo"))
    };
    const quantity = positiveInteger(values.quantity);
    const unitAmountCents = cents(values.unitAmount);
    const billDate = dateToIso(values.billDate);
    const dueDate = dateToIso(values.dueDate);
    if (!values.vendorId || !values.description || !quantity || unitAmountCents == null || !billDate || !dueDate) {
      return fail(400, { error: "Enter vendor, dates, line description, quantity, and amount.", values });
    }

    const result = await createBill(
      {
        tenantId: org.id,
        vendorId: values.vendorId,
        billNumber: values.billNumber || undefined,
        billDate,
        dueDate,
        currency: values.currency,
        memo: values.memo || null,
        requiresApproval: false,
        lineItems: [{ description: values.description, quantity, unitAmountCents, taxCents: 0 }]
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.bill_created",
        actorId: locals.user.id,
        entityType: "bill",
        entityId: result.data.bill.id,
        source: "app/payables",
        payload: { vendorId: values.vendorId, totalCents: result.data.bill.totalCents }
      },
      { auditStore: locals.auditStore }
    );

    return { billCreated: true };
  }
};
