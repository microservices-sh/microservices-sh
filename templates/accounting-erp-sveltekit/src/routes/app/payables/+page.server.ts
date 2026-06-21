import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import {
  createBill,
  createVendor,
  getAgingReport,
  listBills,
  listVendors,
  markBillPayable,
  recordBillPayment
} from "@microservices-sh/accounts-payable";
import { listAccounts } from "@microservices-sh/accounting-core";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { createAccountsPayableAccountingPoster } from "$lib/server/accounts-payable-accounting";

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [vendorsResult, billsResult, agingResult, accountsResult] = await Promise.all([
    listVendors({ tenantId: activeOrgId, includeInactive: true, limit: 250 }, { accountsPayableStore: locals.accountsPayableStore }),
    listBills({ tenantId: activeOrgId, limit: 100 }, { accountsPayableStore: locals.accountsPayableStore }),
    getAgingReport({ tenantId: activeOrgId }, { accountsPayableStore: locals.accountsPayableStore }),
    listAccounts({ tenantId: activeOrgId, includeInactive: false, limit: 500 }, { accountingCoreStore: locals.accountingCoreStore })
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    vendors: vendorsResult.ok ? vendorsResult.data.vendors : [],
    bills: billsResult.ok ? billsResult.data.bills : [],
    aging: agingResult.ok ? agingResult.data.report : null,
    accounts: accountsResult.ok ? accountsResult.data.accounts : [],
    today: today()
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
      memo: text(form.get("memo")),
      expenseAccountId: text(form.get("expenseAccountId")),
      apAccountId: text(form.get("apAccountId"))
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
        apAccountId: values.apAccountId || null,
        requiresApproval: false,
        lineItems: [{ description: values.description, quantity, unitAmountCents, taxCents: 0, expenseAccountId: values.expenseAccountId || null }]
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
  },

  markPayable: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      billId: text(form.get("billId")),
      apAccountId: text(form.get("apAccountId"))
    };
    if (!values.billId || !values.apAccountId) return fail(400, { error: "Choose a bill and AP account.", values });

    try {
      const result = await markBillPayable(
        {
          tenantId: org.id,
          billId: values.billId,
          approvedById: locals.user.id,
          apAccountId: values.apAccountId,
          postToAccounting: true
        },
        {
          accountsPayableStore: locals.accountsPayableStore,
          accountingPoster: createAccountsPayableAccountingPoster({
            accountingCoreStore: locals.accountingCoreStore,
            actor: { id: locals.user.id, email: locals.user.email, permissions }
          }),
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
      if (!result.ok) return fail(result.status, { error: result.error.message, values });

      await recordEvent(
        {
          eventName: "accounts-payable.bill_marked_payable",
          actorId: locals.user.id,
          entityType: "bill",
          entityId: result.data.bill.id,
          source: "app/payables",
          payload: { journalEntryId: result.data.bill.journalEntryId, accountingStatus: result.data.bill.accountingStatus }
        },
        { auditStore: locals.auditStore }
      );

      return { billMarkedPayable: true };
    } catch (error) {
      return fail(409, { error: error instanceof Error ? error.message : "Could not post bill to accounting.", values });
    }
  },

  recordPayment: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      billId: text(form.get("billId")),
      paymentDate: text(form.get("paymentDate")),
      paymentAccountId: text(form.get("paymentAccountId")),
      paymentMethod: text(form.get("paymentMethod")) || "ach",
      referenceNumber: text(form.get("referenceNumber"))
    };
    const paymentDate = dateToIso(values.paymentDate);
    if (!values.billId || !paymentDate || !values.paymentAccountId) {
      return fail(400, { error: "Choose a bill, payment date, and payment account.", values });
    }

    const billsResult = await listBills({ tenantId: org.id, limit: 500 }, { accountsPayableStore: locals.accountsPayableStore });
    if (!billsResult.ok) return fail(billsResult.status, { error: billsResult.error.message, values });
    const bill = billsResult.data.bills.find((candidate) => candidate.id === values.billId);
    if (!bill) return fail(404, { error: "Bill not found.", values });
    if (bill.amountDueCents <= 0) return fail(409, { error: "Bill has no open balance.", values });

    try {
      const result = await recordBillPayment(
        {
          tenantId: org.id,
          vendorId: bill.vendorId,
          paymentDate,
          amountCents: bill.amountDueCents,
          currency: bill.currency,
          paymentAccountId: values.paymentAccountId,
          paymentMethod: values.paymentMethod as "check" | "ach" | "wire" | "card" | "cash" | "other",
          referenceNumber: values.referenceNumber || null,
          idempotencyKey: `ap-payment:${bill.id}:${paymentDate}`,
          applications: [{ billId: bill.id, amountCents: bill.amountDueCents }]
        },
        {
          accountsPayableStore: locals.accountsPayableStore,
          accountingPoster: createAccountsPayableAccountingPoster({
            accountingCoreStore: locals.accountingCoreStore,
            actor: { id: locals.user.id, email: locals.user.email, permissions }
          }),
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
      if (!result.ok) return fail(result.status, { error: result.error.message, values });

      await recordEvent(
        {
          eventName: "accounts-payable.bill_payment_recorded",
          actorId: locals.user.id,
          entityType: "bill_payment",
          entityId: result.data.payment.id,
          source: "app/payables",
          payload: { billId: bill.id, amountCents: result.data.payment.amountCents, journalEntryId: result.data.payment.journalEntryId }
        },
        { auditStore: locals.auditStore }
      );

      return { billPaymentRecorded: true };
    } catch (error) {
      return fail(409, { error: error instanceof Error ? error.message : "Could not post payment to accounting.", values });
    }
  }
};
