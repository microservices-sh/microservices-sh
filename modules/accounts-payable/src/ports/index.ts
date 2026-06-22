import type {
  AccountingBillPaymentPostRequest,
  AccountingBillPostRequest,
  AccountingPostResult,
  AccountsPayableEvent,
  Bill,
  BillFilter,
  BillLineItem,
  BillPayment,
  BillPaymentApplication,
  BillPaymentFilter,
  BillPaymentWithApplications,
  BillWithLineItems,
  RecurringBillLineItem,
  RecurringBillTemplateFilter,
  RecurringBillTemplate,
  RecurringBillTemplateWithLineItems,
  Vendor,
  VendorFilter
} from "../types";

export interface AccountsPayableStore {
  insertVendor(vendor: Vendor): Promise<void>;
  updateVendor(vendor: Vendor): Promise<void>;
  getVendor(tenantId: string, vendorId: string): Promise<Vendor | null>;
  findVendorByExternalRef(tenantId: string, externalSource: string, externalId: string): Promise<Vendor | null>;
  listVendors(filter: VendorFilter): Promise<Vendor[]>;

  insertBill(bill: Bill, lineItems: BillLineItem[]): Promise<void>;
  updateBill(bill: Bill): Promise<void>;
  getBill(tenantId: string, billId: string): Promise<BillWithLineItems | null>;
  findBillByRecurringOccurrence(
    tenantId: string,
    recurringTemplateId: string,
    billDate: string
  ): Promise<BillWithLineItems | null>;
  listBills(filter: BillFilter): Promise<BillWithLineItems[]>;
  listOpenBills(tenantId: string, vendorId?: string): Promise<BillWithLineItems[]>;

  getPayment(tenantId: string, paymentId: string): Promise<BillPaymentWithApplications | null>;
  listPayments(filter: BillPaymentFilter): Promise<BillPaymentWithApplications[]>;
  findPaymentByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BillPaymentWithApplications | null>;
  insertPaymentWithApplications(input: {
    payment: BillPayment;
    applications: BillPaymentApplication[];
    updatedBills: Bill[];
  }): Promise<void>;

  insertRecurringBillTemplate(template: RecurringBillTemplate, lineItems: RecurringBillLineItem[]): Promise<void>;
  getRecurringBillTemplate(tenantId: string, templateId: string): Promise<RecurringBillTemplateWithLineItems | null>;
  listRecurringBillTemplates(filter: RecurringBillTemplateFilter): Promise<RecurringBillTemplateWithLineItems[]>;
  updateRecurringBillTemplate(template: RecurringBillTemplate): Promise<void>;

  writeEvent(event: AccountsPayableEvent): Promise<void>;
}

export interface AccountingPoster {
  postAccountsPayableBill(request: AccountingBillPostRequest): Promise<AccountingPostResult>;
  postAccountsPayablePayment(request: AccountingBillPaymentPostRequest): Promise<AccountingPostResult>;
}
