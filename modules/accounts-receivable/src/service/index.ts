import type { AccountsReceivableAccountingPoster, AccountsReceivableStore } from "../ports";
import type {
  ApplyPaymentResult,
  ApplyPaymentInput,
  CustomerPayment,
  CustomerStatement,
  InvoiceSnapshot,
  ModuleResult,
  PaymentApplication,
  ReceivableAging,
  RecordCustomerPaymentInput,
  TenantContext
} from "../types";

export type AccountsReceivableIdPrefix = "cpay" | "arapp";
export type AccountsReceivableIdFactory = (prefix: AccountsReceivableIdPrefix) => string;

export interface AccountsReceivableServiceDeps {
  store: AccountsReceivableStore;
  accountingPoster?: AccountsReceivableAccountingPoster;
  createId?: AccountsReceivableIdFactory;
  correlationId?: string;
}

export interface AccountsReceivableService {
  upsertInvoiceSnapshot(ctx: TenantContext, invoice: Omit<InvoiceSnapshot, "tenantId">): Promise<ModuleResult<InvoiceSnapshot>>;
  recordCustomerPayment(ctx: TenantContext, input: RecordCustomerPaymentInput): Promise<ModuleResult<CustomerPayment>>;
  applyCustomerPayment(ctx: TenantContext, input: ApplyPaymentInput): Promise<ModuleResult<ApplyPaymentResult>>;
  listOpenReceivables(ctx: TenantContext): Promise<ModuleResult<InvoiceSnapshot[]>>;
  getReceivableAging(ctx: TenantContext, reportDate: string, customerId?: string): Promise<ModuleResult<ReceivableAging>>;
  generateCustomerStatement(ctx: TenantContext, customerId: string, statementDate: string): Promise<ModuleResult<CustomerStatement>>;
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

export function createSequentialAccountsReceivableIdFactory(): AccountsReceivableIdFactory {
  const sequences: Record<AccountsReceivableIdPrefix, number> = { cpay: 0, arapp: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: AccountsReceivableIdPrefix): string {
  const cryptoProvider = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const uuid = cryptoProvider?.randomUUID?.();
  const randomId = uuid?.replaceAll("-", "") ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
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

function validateInvoiceSnapshot(snapshot: InvoiceSnapshot): ModuleResult<InvoiceSnapshot> | null {
  if (snapshot.amountDueCents < 0 || snapshot.amountPaidCents < 0) {
    return fail("invalid_invoice_balance", "Invoice balances cannot be negative.");
  }
  return null;
}

function validatePaymentApplications(
  payment: CustomerPayment,
  applications: ApplyPaymentInput["applications"],
  invoicesById: Map<string, InvoiceSnapshot>
): ModuleResult<ApplyPaymentResult> | null {
  const amountByInvoiceId = new Map<string, number>();
  for (const app of applications) {
    const invoice = invoicesById.get(app.invoiceId);
    if (!invoice) return fail("invoice_not_found", `Invoice ${app.invoiceId} not found.`);
    if (invoice.customerId !== payment.customerId) return fail("customer_mismatch", "Payment customer must match invoice customer.");
    if (invoice.status === "void") return fail("invoice_void", "Cannot apply payment to a void invoice.");
    const invoiceAppliedAmount = (amountByInvoiceId.get(invoice.id) ?? 0) + app.amountCents;
    amountByInvoiceId.set(invoice.id, invoiceAppliedAmount);
    if (invoiceAppliedAmount > invoice.amountDueCents) {
      return fail("invoice_overapplied", "Application exceeds invoice open balance.");
    }
  }
  return null;
}

function normalizeCurrency(value: string | undefined): string {
  const normalized = (value ?? "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function withStoreTransaction<T>(store: AccountsReceivableStore, operation: (transactionStore: AccountsReceivableStore) => Promise<T>) {
  return store.withTransaction ? store.withTransaction(operation) : operation(store);
}

export function createAccountsReceivableService(deps: AccountsReceivableServiceDeps): AccountsReceivableService {
  const createId = deps.createId ?? defaultId;

  return {
    async upsertInvoiceSnapshot(ctx, invoice) {
      const snapshot = { ...invoice, tenantId: ctx.tenantId };
      const validationError = validateInvoiceSnapshot(snapshot);
      if (validationError) return validationError;
      await deps.store.upsertInvoiceSnapshot(snapshot);
      return ok(snapshot);
    },

    async recordCustomerPayment(ctx, input) {
      return withStoreTransaction(deps.store, async (store) => {
        const existingPayment = await store.getPaymentByIdempotencyKey(ctx.tenantId, input.idempotencyKey);
        if (existingPayment) return ok(existingPayment);
        const createdAt = now(ctx);
        const payment: CustomerPayment = {
          id: createId("cpay"),
          tenantId: ctx.tenantId,
          customerId: input.customerId,
          amountCents: input.amountCents,
          unappliedCents: input.amountCents,
          currency: normalizeCurrency(input.currency),
          paymentMethod: optionalText(input.paymentMethod) ?? "manual",
          referenceNumber: optionalText(input.referenceNumber),
          providerPaymentId: optionalText(input.providerPaymentId),
          depositAccountId: optionalText(input.depositAccountId),
          paymentDate: input.paymentDate,
          idempotencyKey: input.idempotencyKey,
          journalEntryId: null,
          postedAt: null,
          createdAt
        };
        await store.insertPayment(payment);
        return ok(payment);
      });
    },

    async applyCustomerPayment(ctx, input) {
      return withStoreTransaction(deps.store, async (store) => {
        const payment = await store.getPayment(ctx.tenantId, input.paymentId);
        if (!payment) return fail("payment_not_found", "Customer payment not found.");
        const totalApplied = input.applications.reduce((sum, app) => sum + app.amountCents, 0);
        if (totalApplied > payment.unappliedCents) return fail("payment_overapplied", "Applications exceed unapplied payment amount.");

        const invoicesById = new Map<string, InvoiceSnapshot>();
        for (const app of input.applications) {
          if (invoicesById.has(app.invoiceId)) continue;
          const invoice = await store.getInvoiceSnapshot(ctx.tenantId, app.invoiceId);
          if (invoice) invoicesById.set(invoice.id, invoice);
        }

        const validationError = validatePaymentApplications(payment, input.applications, invoicesById);
        if (validationError) return validationError;

        const appliedAt = now(ctx);
        const created: PaymentApplication[] = [];
        const updatedInvoices = new Map<string, InvoiceSnapshot>();
        for (const app of input.applications) {
          const invoice = updatedInvoices.get(app.invoiceId) ?? invoicesById.get(app.invoiceId)!;
          const application: PaymentApplication = {
            id: createId("arapp"),
            tenantId: ctx.tenantId,
            paymentId: payment.id,
            invoiceId: invoice.id,
            amountCents: app.amountCents,
            appliedAt
          };
          const amountPaidCents = invoice.amountPaidCents + app.amountCents;
          const amountDueCents = invoice.totalCents - amountPaidCents;
          updatedInvoices.set(invoice.id, {
            ...invoice,
            amountPaidCents,
            amountDueCents,
            status: amountDueCents === 0 ? "paid" : invoice.status
          });
          created.push(application);
        }

        let updatedPayment: CustomerPayment = { ...payment, unappliedCents: payment.unappliedCents - totalApplied };
        if (deps.accountingPoster) {
          const postedAt = now(ctx);
          const posted = await deps.accountingPoster.postAccountsReceivablePayment({
            tenantId: ctx.tenantId,
            payment: updatedPayment,
            applications: created,
            invoices: [...invoicesById.values()],
            correlationId: deps.correlationId ?? null
          });
          updatedPayment = {
            ...updatedPayment,
            journalEntryId: posted.journalEntryId ?? null,
            postedAt
          };
        }

        for (const invoice of updatedInvoices.values()) await store.upsertInvoiceSnapshot(invoice);
        await store.insertApplications(created);
        await store.updatePayment(updatedPayment);
        return ok({ payment: updatedPayment, applications: created, invoices: [...updatedInvoices.values()] });
      });
    },

    async listOpenReceivables(ctx) {
      return ok(await deps.store.listOpenInvoiceSnapshots(ctx.tenantId));
    },

    async getReceivableAging(ctx, reportDate, customerId) {
      const aging = emptyAging();
      const invoices = await deps.store.listOpenInvoiceSnapshots(ctx.tenantId, customerId ? { customerId } : undefined);
      for (const invoice of invoices) addToAging(aging, invoice.dueDate, reportDate, invoice.amountDueCents);
      return ok(aging);
    },

    async generateCustomerStatement(ctx, customerId, statementDate) {
      const customerInvoices = await deps.store.listInvoiceSnapshots(ctx.tenantId, { customerId });
      const customerPayments = await deps.store.listPayments(ctx.tenantId, { customerId });
      const paymentIds = customerPayments.map((payment) => payment.id);
      const customerApplications = paymentIds.length > 0 ? await deps.store.listApplicationsByPaymentIds(ctx.tenantId, paymentIds) : [];
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
      const validationError = validateInvoiceSnapshot(snapshot);
      if (validationError) return validationError;
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
        currency: normalizeCurrency(input.currency),
        paymentMethod: optionalText(input.paymentMethod) ?? "manual",
        referenceNumber: optionalText(input.referenceNumber),
        providerPaymentId: optionalText(input.providerPaymentId),
        depositAccountId: optionalText(input.depositAccountId),
        paymentDate: input.paymentDate,
        idempotencyKey: input.idempotencyKey,
        journalEntryId: null,
        postedAt: null,
        createdAt
      };
      payments.set(payment.id, payment);
      paymentsByIdempotency.set(`${ctx.tenantId}:${input.idempotencyKey}`, payment.id);
      return ok(payment);
    },

    applyCustomerPayment(ctx: TenantContext, input: ApplyPaymentInput): ModuleResult<ApplyPaymentResult> {
      const payment = payments.get(input.paymentId);
      if (!payment || payment.tenantId !== ctx.tenantId) return fail("payment_not_found", "Customer payment not found.");
      const totalApplied = input.applications.reduce((sum, app) => sum + app.amountCents, 0);
      if (totalApplied > payment.unappliedCents) return fail("payment_overapplied", "Applications exceed unapplied payment amount.");
      const invoicesById = new Map<string, InvoiceSnapshot>();
      for (const app of input.applications) {
        const invoice = invoices.get(app.invoiceId);
        if (invoice?.tenantId === ctx.tenantId) invoicesById.set(invoice.id, invoice);
      }
      const validationError = validatePaymentApplications(payment, input.applications, invoicesById);
      if (validationError) return validationError;
      const appliedAt = now(ctx);
      const created: PaymentApplication[] = [];
      const updatedInvoices = new Map<string, InvoiceSnapshot>();
      for (const app of input.applications) {
        const invoice = updatedInvoices.get(app.invoiceId) ?? invoices.get(app.invoiceId)!;
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
        const updatedInvoice = {
          ...invoice,
          amountPaidCents,
          amountDueCents,
          status: amountDueCents === 0 ? "paid" : invoice.status
        };
        invoices.set(invoice.id, updatedInvoice);
        updatedInvoices.set(invoice.id, updatedInvoice);
        applications.set(application.id, application);
        created.push(application);
      }
      const updatedPayment = { ...payment, unappliedCents: payment.unappliedCents - totalApplied };
      payments.set(payment.id, updatedPayment);
      return ok({ payment: updatedPayment, applications: created, invoices: [...updatedInvoices.values()] });
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
