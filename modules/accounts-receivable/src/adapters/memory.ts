import type { AccountsReceivableListFilter, AccountsReceivableStore } from "../ports";
import type { CustomerPayment, InvoiceSnapshot, PaymentApplication } from "../types";

export interface AccountsReceivableMemoryStoreState {
  invoices?: InvoiceSnapshot[];
  payments?: CustomerPayment[];
  applications?: PaymentApplication[];
}

function paymentIdempotencyKey(payment: CustomerPayment): string {
  return `${payment.tenantId}:${payment.idempotencyKey}`;
}

function matchesFilter<T extends { tenantId: string; customerId?: string }>(record: T, tenantId: string, filter?: AccountsReceivableListFilter) {
  return record.tenantId === tenantId && (!filter?.customerId || record.customerId === filter.customerId);
}

export function createAccountsReceivableMemoryStore(initialState: AccountsReceivableMemoryStoreState = {}): AccountsReceivableStore {
  const invoices = new Map<string, InvoiceSnapshot>();
  const payments = new Map<string, CustomerPayment>();
  const applications = new Map<string, PaymentApplication>();
  const paymentsByIdempotency = new Map<string, string>();

  for (const invoice of initialState.invoices ?? []) invoices.set(invoice.id, { ...invoice });
  for (const payment of initialState.payments ?? []) {
    payments.set(payment.id, { ...payment });
    paymentsByIdempotency.set(paymentIdempotencyKey(payment), payment.id);
  }
  for (const application of initialState.applications ?? []) applications.set(application.id, { ...application });

  const store: AccountsReceivableStore = {
    async getInvoiceSnapshot(tenantId, invoiceId) {
      const invoice = invoices.get(invoiceId);
      return invoice && invoice.tenantId === tenantId ? { ...invoice } : null;
    },

    async listInvoiceSnapshots(tenantId, filter) {
      return [...invoices.values()].filter((invoice) => matchesFilter(invoice, tenantId, filter)).map((invoice) => ({ ...invoice }));
    },

    async listOpenInvoiceSnapshots(tenantId, filter) {
      return [...invoices.values()]
        .filter(
          (invoice) =>
            matchesFilter(invoice, tenantId, filter) &&
            invoice.amountDueCents > 0 &&
            invoice.status !== "void"
        )
        .map((invoice) => ({ ...invoice }));
    },

    async upsertInvoiceSnapshot(invoice) {
      invoices.set(invoice.id, { ...invoice });
    },

    async getPayment(tenantId, paymentId) {
      const payment = payments.get(paymentId);
      return payment && payment.tenantId === tenantId ? { ...payment } : null;
    },

    async getPaymentByIdempotencyKey(tenantId, idempotencyKey) {
      const paymentId = paymentsByIdempotency.get(`${tenantId}:${idempotencyKey}`);
      if (!paymentId) return null;
      const payment = payments.get(paymentId);
      return payment ? { ...payment } : null;
    },

    async listPayments(tenantId, filter) {
      return [...payments.values()].filter((payment) => matchesFilter(payment, tenantId, filter)).map((payment) => ({ ...payment }));
    },

    async insertPayment(payment) {
      const idempotencyKey = paymentIdempotencyKey(payment);
      const existingPaymentId = paymentsByIdempotency.get(idempotencyKey);
      if (existingPaymentId && existingPaymentId !== payment.id) {
        throw new Error(`Duplicate accounts receivable payment idempotency key: ${idempotencyKey}`);
      }
      payments.set(payment.id, { ...payment });
      paymentsByIdempotency.set(idempotencyKey, payment.id);
    },

    async updatePayment(payment) {
      payments.set(payment.id, { ...payment });
      paymentsByIdempotency.set(paymentIdempotencyKey(payment), payment.id);
    },

    async listApplicationsByPaymentIds(tenantId, paymentIds) {
      const paymentIdSet = new Set(paymentIds);
      return [...applications.values()]
        .filter((application) => application.tenantId === tenantId && paymentIdSet.has(application.paymentId))
        .map((application) => ({ ...application }));
    },

    async insertApplications(newApplications) {
      for (const application of newApplications) applications.set(application.id, { ...application });
    },

    async withTransaction(operation) {
      const invoiceSnapshot = new Map(invoices);
      const paymentSnapshot = new Map(payments);
      const applicationSnapshot = new Map(applications);
      const paymentIdempotencySnapshot = new Map(paymentsByIdempotency);
      try {
        return await operation(store);
      } catch (error) {
        invoices.clear();
        payments.clear();
        applications.clear();
        paymentsByIdempotency.clear();
        for (const [key, value] of invoiceSnapshot) invoices.set(key, value);
        for (const [key, value] of paymentSnapshot) payments.set(key, value);
        for (const [key, value] of applicationSnapshot) applications.set(key, value);
        for (const [key, value] of paymentIdempotencySnapshot) paymentsByIdempotency.set(key, value);
        throw error;
      }
    }
  };

  return store;
}
