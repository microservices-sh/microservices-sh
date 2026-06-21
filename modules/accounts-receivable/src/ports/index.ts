import type { CustomerPayment, InvoiceSnapshot, PaymentApplication } from "../types";

export interface AccountsReceivableListFilter {
  customerId?: string;
}

export interface AccountsReceivableStore {
  getInvoiceSnapshot(tenantId: string, invoiceId: string): Promise<InvoiceSnapshot | null>;
  listInvoiceSnapshots(tenantId: string, filter?: AccountsReceivableListFilter): Promise<InvoiceSnapshot[]>;
  listOpenInvoiceSnapshots(tenantId: string, filter?: AccountsReceivableListFilter): Promise<InvoiceSnapshot[]>;
  upsertInvoiceSnapshot(invoice: InvoiceSnapshot): Promise<void>;

  getPayment(tenantId: string, paymentId: string): Promise<CustomerPayment | null>;
  getPaymentByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<CustomerPayment | null>;
  listPayments(tenantId: string, filter?: AccountsReceivableListFilter): Promise<CustomerPayment[]>;
  insertPayment(payment: CustomerPayment): Promise<void>;
  updatePayment(payment: CustomerPayment): Promise<void>;

  listApplicationsByPaymentIds(tenantId: string, paymentIds: string[]): Promise<PaymentApplication[]>;
  insertApplications(applications: PaymentApplication[]): Promise<void>;

  withTransaction?<T>(operation: (store: AccountsReceivableStore) => Promise<T>): Promise<T>;
}
