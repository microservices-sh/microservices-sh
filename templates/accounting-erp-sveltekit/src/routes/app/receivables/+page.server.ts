import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createAccountsReceivableService, getAccountsReceivableModuleStatus } from "@microservices-sh/accounts-receivable";
import type { AccountsReceivableService, InvoiceSnapshot, TenantContext } from "@microservices-sh/accounts-receivable";
import { authContext, getInvoiceScoped, recordPaymentScoped } from "@microservices-sh/invoice";
import { recordEvent } from "@microservices-sh/audit-log";
import { listCustomers } from "@microservices-sh/customer";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { syncInvoiceToReceivables } from "$lib/server/accounts-receivable-sync";
import { createAccountsReceivableAccountingPoster } from "$lib/server/accounts-receivable-accounting";

const REPORT_DATE = "2026-06-21T00:00:00.000Z";
const REPORT_DAY = REPORT_DATE.slice(0, 10);

const DEMO_RECEIVABLES: Array<Omit<InvoiceSnapshot, "tenantId">> = [
  {
    id: "ar-demo-1001",
    customerId: "cust-demo-1",
    invoiceNumber: "INV-1001",
    issuedAt: "2026-05-20T00:00:00.000Z",
    dueDate: "2026-06-19T00:00:00.000Z",
    totalCents: 180000,
    amountPaidCents: 50000,
    amountDueCents: 130000,
    status: "open"
  },
  {
    id: "ar-demo-1002",
    customerId: "cust-demo-2",
    invoiceNumber: "INV-1002",
    issuedAt: "2026-06-10T00:00:00.000Z",
    dueDate: "2026-07-10T00:00:00.000Z",
    totalCents: 72500,
    amountPaidCents: 0,
    amountDueCents: 72500,
    status: "open"
  }
];

const demoReceivablesSeeded = new Set<string>();

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function cents(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function dateToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function createPaymentKey(invoiceId: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `ar-payment:${invoiceId}:${randomId}`;
}

async function seedDemoReceivables(service: AccountsReceivableService, ctx: TenantContext, hasDb: boolean): Promise<void> {
  if (hasDb) return;
  if (demoReceivablesSeeded.has(ctx.tenantId)) return;
  await Promise.all(DEMO_RECEIVABLES.map((invoice) => service.upsertInvoiceSnapshot(ctx, invoice)));
  demoReceivablesSeeded.add(ctx.tenantId);
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounts-receivable", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = locals.accountsReceivableService;
  const ctx = { tenantId: activeOrgId, actorId: locals.user.id, now: REPORT_DATE };
  await seedDemoReceivables(service, ctx, Boolean(platform?.env?.DB));

  const [receivables, aging, customers] = await Promise.all([
    service.listOpenReceivables(ctx),
    service.getReceivableAging(ctx, REPORT_DATE),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);
  const customerNameById = new Map(customers.data.customers.map((customer) => [customer.id, customer.name]));

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    reportDate: REPORT_DAY,
    status: getAccountsReceivableModuleStatus(),
    receivables: receivables.ok
      ? receivables.data.map((invoice) => ({
          ...invoice,
          customerName: customerNameById.get(invoice.customerId) ?? invoice.customerId,
          canRecordPayment: !invoice.id.startsWith("ar-demo-"),
          paymentKey: createPaymentKey(invoice.id)
        }))
      : [],
    aging: aging.ok ? aging.data : null
  };
};

export const actions: Actions = {
  recordPayment: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-receivable", platform);
    requireModule("accounting-core", platform);
    requireModule("invoice", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      invoiceId: text(form.get("invoiceId")),
      amount: text(form.get("amount")),
      paymentDate: text(form.get("paymentDate")),
      paymentKey: text(form.get("paymentKey"))
    };
    const amountCents = cents(values.amount);
    const paymentDate = dateToIso(values.paymentDate);
    if (!values.invoiceId || amountCents == null || !paymentDate) {
      return fail(400, { error: "Choose an invoice, payment date, and amount greater than zero.", values });
    }

    const service = locals.accountsReceivableService;
    const ctx = { tenantId: org.id, actorId: locals.user.id, now: REPORT_DATE };
    const invoiceCtx = authContext({ orgId: org.id, actorId: locals.user.id, roles: permissions });
    await seedDemoReceivables(service, ctx, Boolean(platform?.env?.DB));
    const receivables = await service.listOpenReceivables(ctx);
    if (!receivables.ok) return fail(400, { error: receivables.error?.message ?? "Could not load open receivables.", values });
    const invoice = receivables.data.find((item) => item.id === values.invoiceId);
    if (!invoice) return fail(404, { error: "Open receivable not found.", values });
    if (invoice.id.startsWith("ar-demo-")) {
      return fail(409, { error: "Demo receivables are read-only. Create an invoice to record a real payment.", values });
    }
    if (amountCents > invoice.amountDueCents) return fail(400, { error: "Payment exceeds the invoice open balance.", values });

    const idempotencyKey = `${values.paymentKey || createPaymentKey(invoice.id)}:${values.paymentDate}:${amountCents}`;
    const currentInvoice = await getInvoiceScoped(invoiceCtx, invoice.id, { invoiceStore: locals.invoiceStore });
    if (!currentInvoice.ok || !currentInvoice.data) {
      return fail(currentInvoice.status ?? 404, { error: currentInvoice.error?.message ?? "Invoice not found.", values });
    }
    if (currentInvoice.data.invoice.status !== "open") {
      return fail(409, { error: "Only open invoices can receive payments.", values });
    }
    const currentOutstandingCents = Math.max(0, currentInvoice.data.invoice.totalCents - currentInvoice.data.invoice.amountPaidCents);
    if (amountCents > currentOutstandingCents) {
      return fail(400, { error: "Payment exceeds the canonical invoice open balance.", values });
    }

    const arService = createAccountsReceivableService({
      store: locals.accountsReceivableStore,
      accountingPoster: createAccountsReceivableAccountingPoster({
        accountingCoreStore: locals.accountingCoreStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      })
    });
    const customerPayment = await arService.recordCustomerPayment(ctx, {
      customerId: invoice.customerId,
      amountCents,
      currency: currentInvoice.data.invoice.currency,
      paymentMethod: "manual",
      paymentDate,
      idempotencyKey
    });
    if (!customerPayment.ok || !customerPayment.data) {
      return fail(400, { error: customerPayment.error?.message ?? "Could not record the customer payment.", values });
    }

    const application = customerPayment.data.unappliedCents > 0
      ? await arService.applyCustomerPayment(ctx, {
          paymentId: customerPayment.data.id,
          applications: [{ invoiceId: invoice.id, amountCents }]
        })
      : null;
    if (application && (!application.ok || !application.data)) {
      return fail(400, { error: application.error?.message ?? "Could not apply the customer payment.", values });
    }

    const payment = await recordPaymentScoped(
      invoiceCtx,
      {
        invoiceId: invoice.id,
        amountCents,
        idempotencyKey
      },
      { invoiceStore: locals.invoiceStore }
    );
    if (!payment.ok || !payment.data) {
      return fail(payment.status ?? 400, { error: payment.error?.message ?? "Could not record the invoice payment.", values });
    }

    const canonicalInvoice = await getInvoiceScoped(invoiceCtx, invoice.id, { invoiceStore: locals.invoiceStore });
    let syncWarning: string | null = canonicalInvoice.ok && canonicalInvoice.data ? null : "Could not load the paid invoice for AR sync.";
    if (canonicalInvoice.ok && canonicalInvoice.data) {
      const synced = await syncInvoiceToReceivables({
        accountsReceivableService: arService,
        tenantId: org.id,
        actorId: locals.user.id,
        invoice: canonicalInvoice.data.invoice
      });
      if (!synced.ok) syncWarning = synced.message;
    }

    await recordEvent(
      {
        eventName: "accounts-receivable.payment_applied",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: invoice.id,
        source: "app/receivables",
        payload: {
          amountCents,
          customerId: invoice.customerId,
          paymentDate,
          idempotencyKey,
          customerPaymentId: customerPayment.data.id,
          paymentApplicationIds: application?.ok ? application.data.applications.map((item) => item.id) : [],
          journalEntryId: application?.ok ? application.data.payment.journalEntryId : customerPayment.data.journalEntryId,
          invoiceStatus: payment.data.status,
          receivablesSynced: syncWarning === null,
          receivablesSyncError: syncWarning
        }
      },
      { auditStore: locals.auditStore }
    );

    return { paymentRecorded: true, paid: payment.data.status === "paid", syncWarning };
  }
};
