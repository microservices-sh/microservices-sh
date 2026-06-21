import type {
  CustomerPayment,
  CustomerStatement,
  InvoiceSnapshot,
  ModuleResult,
  PaymentApplication,
  ReceivableAging,
  TenantContext
} from "../types";

interface RecordCustomerPaymentInput {
  customerId: string;
  amountCents: number;
  paymentDate: string;
  idempotencyKey: string;
}

interface ApplyPaymentInput {
  paymentId: string;
  applications: Array<{ invoiceId: string; amountCents: number }>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

function emptyAging(): ReceivableAging {
  return {
    currentCents: 0,
    days1To30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    days90PlusCents: 0,
    totalOpenCents: 0
  };
}

function addToAging(aging: ReceivableAging, dueDate: string, reportDate: string, amountCents: number) {
  const days = Math.floor((Date.parse(reportDate) - Date.parse(dueDate)) / 86_400_000);
  aging.totalOpenCents += amountCents;
  if (days <= 0) aging.currentCents += amountCents;
  else if (days <= 30) aging.days1To30Cents += amountCents;
  else if (days <= 60) aging.days31To60Cents += amountCents;
  else if (days <= 90) aging.days61To90Cents += amountCents;
  else aging.days90PlusCents += amountCents;
}

export function createAccountsReceivableMemoryService() {
  const invoices = new Map<string, InvoiceSnapshot>();
  const payments = new Map<string, CustomerPayment>();
  const applications = new Map<string, PaymentApplication>();
  const paymentsByIdempotency = new Map<string, string>();
  let paymentSequence = 0;
  let applicationSequence = 0;

  return {
    upsertInvoiceSnapshot(ctx: TenantContext, invoice: Omit<InvoiceSnapshot, "tenantId">): ModuleResult<InvoiceSnapshot> {
      const snapshot = { ...invoice, tenantId: ctx.tenantId };
      if (snapshot.amountDueCents < 0 || snapshot.amountPaidCents < 0) {
        return fail("invalid_invoice_balance", "Invoice balances cannot be negative.");
      }
      invoices.set(snapshot.id, snapshot);
      return ok(snapshot);
    },

    recordCustomerPayment(ctx: TenantContext, input: RecordCustomerPaymentInput): ModuleResult<CustomerPayment> {
      const existingPaymentId = paymentsByIdempotency.get(`${ctx.tenantId}:${input.idempotencyKey}`);
      if (existingPaymentId) return ok(payments.get(existingPaymentId)!);
      const createdAt = now(ctx);
      const payment: CustomerPayment = {
        id: id("cpay", ++paymentSequence),
        tenantId: ctx.tenantId,
        customerId: input.customerId,
        amountCents: input.amountCents,
        unappliedCents: input.amountCents,
        paymentDate: input.paymentDate,
        idempotencyKey: input.idempotencyKey,
        createdAt
      };
      payments.set(payment.id, payment);
      paymentsByIdempotency.set(`${ctx.tenantId}:${input.idempotencyKey}`, payment.id);
      return ok(payment);
    },

    applyCustomerPayment(ctx: TenantContext, input: ApplyPaymentInput): ModuleResult<PaymentApplication[]> {
      const payment = payments.get(input.paymentId);
      if (!payment || payment.tenantId !== ctx.tenantId) return fail("payment_not_found", "Customer payment not found.");
      const totalApplied = input.applications.reduce((sum, app) => sum + app.amountCents, 0);
      if (totalApplied > payment.unappliedCents) return fail("payment_overapplied", "Applications exceed unapplied payment amount.");
      for (const app of input.applications) {
        const invoice = invoices.get(app.invoiceId);
        if (!invoice || invoice.tenantId !== ctx.tenantId) return fail("invoice_not_found", `Invoice ${app.invoiceId} not found.`);
        if (invoice.customerId !== payment.customerId) return fail("customer_mismatch", "Payment customer must match invoice customer.");
        if (invoice.status === "void") return fail("invoice_void", "Cannot apply payment to a void invoice.");
        if (app.amountCents > invoice.amountDueCents) return fail("invoice_overapplied", "Application exceeds invoice open balance.");
      }
      const appliedAt = now(ctx);
      const created: PaymentApplication[] = [];
      for (const app of input.applications) {
        const invoice = invoices.get(app.invoiceId)!;
        const application: PaymentApplication = {
          id: id("arapp", ++applicationSequence),
          tenantId: ctx.tenantId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amountCents: app.amountCents,
          appliedAt
        };
        const amountPaidCents = invoice.amountPaidCents + app.amountCents;
        const amountDueCents = invoice.totalCents - amountPaidCents;
        invoices.set(invoice.id, {
          ...invoice,
          amountPaidCents,
          amountDueCents,
          status: amountDueCents === 0 ? "paid" : invoice.status
        });
        applications.set(application.id, application);
        created.push(application);
      }
      payments.set(payment.id, { ...payment, unappliedCents: payment.unappliedCents - totalApplied });
      return ok(created);
    },

    listOpenReceivables(ctx: TenantContext): ModuleResult<InvoiceSnapshot[]> {
      return ok([...invoices.values()].filter((invoice) => invoice.tenantId === ctx.tenantId && invoice.amountDueCents > 0 && invoice.status !== "void"));
    },

    getReceivableAging(ctx: TenantContext, reportDate: string, customerId?: string): ModuleResult<ReceivableAging> {
      const aging = emptyAging();
      for (const invoice of invoices.values()) {
        if (invoice.tenantId !== ctx.tenantId || invoice.status === "void" || invoice.amountDueCents <= 0) continue;
        if (customerId && invoice.customerId !== customerId) continue;
        addToAging(aging, invoice.dueDate, reportDate, invoice.amountDueCents);
      }
      return ok(aging);
    },

    generateCustomerStatement(ctx: TenantContext, customerId: string, statementDate: string): ModuleResult<CustomerStatement> {
      const customerInvoices = [...invoices.values()].filter((invoice) => invoice.tenantId === ctx.tenantId && invoice.customerId === customerId);
      const customerPayments = [...payments.values()].filter((payment) => payment.tenantId === ctx.tenantId && payment.customerId === customerId);
      const paymentIds = new Set(customerPayments.map((payment) => payment.id));
      const customerApplications = [...applications.values()].filter((application) => application.tenantId === ctx.tenantId && paymentIds.has(application.paymentId));
      const aging = emptyAging();
      for (const invoice of customerInvoices) {
        if (invoice.status !== "void" && invoice.amountDueCents > 0) {
          addToAging(aging, invoice.dueDate, statementDate, invoice.amountDueCents);
        }
      }
      return ok({
        tenantId: ctx.tenantId,
        customerId,
        statementDate,
        invoices: customerInvoices,
        payments: customerPayments,
        applications: customerApplications,
        aging
      });
    }
  };
}

export function getAccountsReceivableModuleStatus() {
  return { id: "accounts-receivable", status: "draft" } as const;
}
