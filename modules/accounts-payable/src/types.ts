import type { Result } from "@microservices-sh/connection-contract";

export type BillStatus = "draft" | "pending_approval" | "payable" | "partial" | "paid" | "void";
export type BillAccountingStatus = "unposted" | "posted";
export type BillPaymentStatus = "posted" | "void";
export type BillPaymentMethod = "check" | "ach" | "wire" | "card" | "cash" | "other";
export type RecurringBillFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type RecurringBillStatus = "active" | "paused" | "cancelled" | "completed";

export interface Actor {
  id: string;
  email?: string;
  permissions?: string[];
}

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxId: string | null;
  is1099Vendor: boolean;
  defaultExpenseAccountId: string | null;
  defaultPaymentTermsDays: number;
  currency: string;
  externalId: string | null;
  externalSource: string | null;
  notes: string | null;
  active: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorFilter {
  tenantId: string;
  search?: string;
  active?: boolean;
  includeInactive?: boolean;
  externalSource?: string;
  limit?: number;
}

export interface BillLineItem {
  id: string;
  tenantId: string;
  billId: string;
  expenseAccountId: string | null;
  description: string;
  quantity: number;
  unitAmountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  tenantId: string;
  billNumber: string;
  vendorId: string;
  vendorBillNumber: string | null;
  status: BillStatus;
  accountingStatus: BillAccountingStatus;
  billDate: string;
  dueDate: string;
  paidAt: string | null;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  memo: string | null;
  apAccountId: string | null;
  journalEntryId: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  recurringTemplateId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillWithLineItems extends Bill {
  lineItems: BillLineItem[];
}

export interface BillFilter {
  tenantId: string;
  vendorId?: string;
  status?: BillStatus;
  statuses?: BillStatus[];
  limit?: number;
}

export interface BillTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export interface BillPayment {
  id: string;
  tenantId: string;
  paymentNumber: string;
  vendorId: string;
  paymentDate: string;
  amountCents: number;
  unappliedAmountCents: number;
  currency: string;
  paymentAccountId: string | null;
  paymentMethod: BillPaymentMethod | null;
  referenceNumber: string | null;
  memo: string | null;
  status: BillPaymentStatus;
  idempotencyKey: string | null;
  journalEntryId: string | null;
  postedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillPaymentApplication {
  id: string;
  tenantId: string;
  paymentId: string;
  billId: string;
  amountAppliedCents: number;
  appliedAt: string;
  createdAt: string;
}

export interface BillPaymentWithApplications extends BillPayment {
  applications: BillPaymentApplication[];
}

export interface BillPaymentFilter {
  tenantId: string;
  vendorId?: string;
  billId?: string;
  status?: BillPaymentStatus;
  paymentDateFrom?: string;
  paymentDateBefore?: string;
  limit?: number;
}

export interface Vendor1099ReportVendor {
  vendorId: string;
  name: string;
  email: string | null;
  currency: string;
  taxIdOnFile: boolean;
  totalPaidCents: number;
  paymentCount: number;
  readyForReview: boolean;
  warnings: string[];
}

export interface Vendor1099Report {
  tenantId: string;
  year: number;
  startDate: string;
  endDate: string;
  vendors: Vendor1099ReportVendor[];
  totals: {
    vendorCount: number;
    readyCount: number;
    missingTaxIdCount: number;
    totalPaidCents: number;
  };
}

export interface RecurringBillTemplate {
  id: string;
  tenantId: string;
  name: string;
  vendorId: string;
  frequency: RecurringBillFrequency;
  customDays: number | null;
  status: RecurringBillStatus;
  currency: string;
  paymentTermsDays: number;
  nextBillDate: string;
  lastBillDate: string | null;
  maxOccurrences: number | null;
  billsGenerated: number;
  memo: string | null;
  autoMarkPayable: boolean;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringBillLineItem {
  id: string;
  tenantId: string;
  recurringBillTemplateId: string;
  expenseAccountId: string | null;
  description: string;
  quantity: number;
  unitAmountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringBillTemplateWithLineItems extends RecurringBillTemplate {
  lineItems: RecurringBillLineItem[];
}

export interface RecurringBillTemplateFilter {
  tenantId: string;
  vendorId?: string;
  status?: RecurringBillStatus;
  statuses?: RecurringBillStatus[];
  dueOnOrBefore?: string;
  limit?: number;
}

export interface AgingBill {
  id: string;
  billNumber: string;
  vendorId: string;
  billDate: string;
  dueDate: string;
  totalCents: number;
  amountDueCents: number;
  daysOverdue: number;
  agingBucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
}

export interface AgingVendor {
  vendorId: string;
  currentCents: number;
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  days90PlusCents: number;
  totalCents: number;
  bills: AgingBill[];
}

export interface AgingReport {
  tenantId: string;
  asOfDate: string;
  vendors: AgingVendor[];
  totals: {
    currentCents: number;
    days1To30Cents: number;
    days31To60Cents: number;
    days61To90Cents: number;
    days90PlusCents: number;
    totalCents: number;
  };
}

export interface AccountsPayableEvent {
  eventName:
    | "accounts-payable.vendor_created"
    | "accounts-payable.vendor_updated"
    | "accounts-payable.vendor_status_updated"
    | "accounts-payable.bill_created"
    | "accounts-payable.bill_marked_payable"
    | "accounts-payable.bill_posted"
    | "accounts-payable.bill_voided"
    | "accounts-payable.bill_payment_recorded"
    | "accounts-payable.bill_payment_voided"
    | "accounts-payable.bill_paid"
    | "accounts-payable.recurring_bill_template_created"
    | "accounts-payable.recurring_bill_template_status_updated"
    | "accounts-payable.recurring_bill_generated";
  entityType: "accounts-payable";
  entityId: string;
  tenantId: string;
  payload: Record<string, unknown>;
}

export interface AccountingBillPostRequest {
  tenantId: string;
  bill: BillWithLineItems;
  apAccountId: string | null;
  correlationId?: string | null;
}

export interface AccountingBillVoidRequest {
  tenantId: string;
  bill: BillWithLineItems;
  reason?: string | null;
  voidedById?: string | null;
  reversalDate?: string | null;
  reversalPeriodId?: string | null;
  correlationId?: string | null;
}

export interface AccountingBillPaymentPostRequest {
  tenantId: string;
  payment: BillPaymentWithApplications;
  bills: BillWithLineItems[];
  correlationId?: string | null;
}

export interface AccountingBillPaymentVoidRequest {
  tenantId: string;
  payment: BillPaymentWithApplications;
  reason?: string | null;
  voidedById?: string | null;
  reversalDate?: string | null;
  reversalPeriodId?: string | null;
  correlationId?: string | null;
}

export interface AccountingPostResult {
  journalEntryId?: string | null;
}

export interface AccountingVoidResult {
  reversalEntryId?: string | null;
}

export type AccountsPayableResult<T> = Result<T>;
