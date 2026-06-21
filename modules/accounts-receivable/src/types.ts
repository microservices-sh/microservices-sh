export interface AccountsReceivableConfig {
  enabled: boolean;
}

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface RecordCustomerPaymentInput {
  customerId: string;
  amountCents: number;
  paymentDate: string;
  idempotencyKey: string;
  currency?: string;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  providerPaymentId?: string | null;
  depositAccountId?: string | null;
}

export interface ApplyPaymentInput {
  paymentId: string;
  applications: Array<{ invoiceId: string; amountCents: number }>;
}

export interface InvoiceSnapshot {
  id: string;
  tenantId: string;
  customerId: string;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  status: "open" | "paid" | "void";
}

export interface CustomerPayment {
  id: string;
  tenantId: string;
  customerId: string;
  amountCents: number;
  unappliedCents: number;
  currency: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  providerPaymentId: string | null;
  depositAccountId: string | null;
  paymentDate: string;
  idempotencyKey: string;
  journalEntryId: string | null;
  postedAt: string | null;
  createdAt: string;
}

export interface PaymentApplication {
  id: string;
  tenantId: string;
  paymentId: string;
  invoiceId: string;
  amountCents: number;
  appliedAt: string;
}

export interface ReceivableAging {
  currentCents: number;
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  days90PlusCents: number;
  totalOpenCents: number;
}

export interface CustomerStatement {
  tenantId: string;
  customerId: string;
  statementDate: string;
  invoices: InvoiceSnapshot[];
  payments: CustomerPayment[];
  applications: PaymentApplication[];
  aging: ReceivableAging;
}

export interface ApplyPaymentResult {
  payment: CustomerPayment;
  applications: PaymentApplication[];
  invoices: InvoiceSnapshot[];
}

export interface AccountsReceivablePaymentPostRequest {
  tenantId: string;
  payment: CustomerPayment;
  applications: PaymentApplication[];
  invoices: InvoiceSnapshot[];
  correlationId?: string | null;
}

export interface AccountingPostResult {
  journalEntryId?: string | null;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type AccountsReceivableRecord = InvoiceSnapshot | CustomerPayment | PaymentApplication;
