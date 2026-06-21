import type { CustomerPayment, InvoiceSnapshot, PaymentApplication } from "../types";

export interface AccountsReceivableStore {
  upsertInvoiceSnapshot(invoice: InvoiceSnapshot): Promise<void>;
  insertPayment(payment: CustomerPayment): Promise<void>;
  insertApplications(applications: PaymentApplication[]): Promise<void>;
}
