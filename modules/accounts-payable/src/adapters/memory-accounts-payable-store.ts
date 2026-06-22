import type { AccountsPayableStore } from "../ports";
import type {
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
  RecurringBillTemplate,
  RecurringBillTemplateFilter,
  RecurringBillTemplateWithLineItems,
  Vendor,
  VendorFilter
} from "../types";

function cloneVendor(vendor: Vendor): Vendor {
  return { ...vendor };
}

function cloneBill(bill: Bill): Bill {
  return { ...bill };
}

function cloneLine(line: BillLineItem): BillLineItem {
  return { ...line };
}

function clonePayment(payment: BillPayment): BillPayment {
  return { ...payment };
}

function cloneApplication(application: BillPaymentApplication): BillPaymentApplication {
  return { ...application };
}

function withLineItems(bill: Bill, lines: BillLineItem[]): BillWithLineItems {
  return { ...cloneBill(bill), lineItems: lines.map(cloneLine) };
}

function withApplications(
  payment: BillPayment,
  applications: BillPaymentApplication[]
): BillPaymentWithApplications {
  return { ...clonePayment(payment), applications: applications.map(cloneApplication) };
}

function matchesPaymentFilter(
  payment: BillPayment,
  applications: BillPaymentApplication[],
  filter: BillPaymentFilter
): boolean {
  return (
    payment.tenantId === filter.tenantId &&
    (!filter.vendorId || payment.vendorId === filter.vendorId) &&
    (!filter.status || payment.status === filter.status) &&
    (!filter.billId || applications.some((application) => application.billId === filter.billId))
  );
}

function matchesBillFilter(bill: Bill, filter: BillFilter): boolean {
  return (
    bill.tenantId === filter.tenantId &&
    (!filter.vendorId || bill.vendorId === filter.vendorId) &&
    (!filter.status || bill.status === filter.status) &&
    (!filter.statuses || filter.statuses.includes(bill.status))
  );
}

function cloneRecurringLine(line: RecurringBillLineItem): RecurringBillLineItem {
  return { ...line };
}

function withRecurringLineItems(
  template: RecurringBillTemplate,
  lines: RecurringBillLineItem[]
): RecurringBillTemplateWithLineItems {
  return { ...template, lineItems: lines.map(cloneRecurringLine) };
}

function matchesRecurringTemplateFilter(template: RecurringBillTemplate, filter: RecurringBillTemplateFilter): boolean {
  return (
    template.tenantId === filter.tenantId &&
    (!filter.vendorId || template.vendorId === filter.vendorId) &&
    (!filter.status || template.status === filter.status) &&
    (!filter.statuses || filter.statuses.includes(template.status)) &&
    (!filter.dueOnOrBefore || template.nextBillDate <= filter.dueOnOrBefore)
  );
}

export function createMemoryAccountsPayableStore(): AccountsPayableStore {
  const vendors = new Map<string, Vendor>();
  const bills = new Map<string, Bill>();
  const linesByBill = new Map<string, BillLineItem[]>();
  const payments = new Map<string, BillPayment>();
  const applicationsByPayment = new Map<string, BillPaymentApplication[]>();
  const recurringTemplates = new Map<string, RecurringBillTemplate>();
  const recurringLinesByTemplate = new Map<string, RecurringBillLineItem[]>();
  const events: AccountsPayableEvent[] = [];

  return {
    async insertVendor(vendor) {
      vendors.set(vendor.id, cloneVendor(vendor));
    },

    async updateVendor(vendor) {
      if (vendors.has(vendor.id)) vendors.set(vendor.id, cloneVendor(vendor));
    },

    async getVendor(tenantId, vendorId) {
      const vendor = vendors.get(vendorId);
      return vendor && vendor.tenantId === tenantId ? cloneVendor(vendor) : null;
    },

    async findVendorByExternalRef(tenantId, externalSource, externalId) {
      const vendor = [...vendors.values()].find(
        (candidate) =>
          candidate.tenantId === tenantId &&
          candidate.externalSource === externalSource &&
          candidate.externalId === externalId
      );
      return vendor ? cloneVendor(vendor) : null;
    },

    async listVendors(filter: VendorFilter) {
      const search = filter.search?.toLowerCase();
      return [...vendors.values()]
        .filter((vendor) => {
          if (vendor.tenantId !== filter.tenantId) return false;
          if (!filter.includeInactive && filter.active === undefined && !vendor.active) return false;
          if (filter.active !== undefined && vendor.active !== filter.active) return false;
          if (filter.externalSource && vendor.externalSource !== filter.externalSource) return false;
          if (search) {
            const haystack = `${vendor.name} ${vendor.email ?? ""} ${vendor.phone ?? ""}`.toLowerCase();
            if (!haystack.includes(search)) return false;
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, filter.limit ?? 100)
        .map(cloneVendor);
    },

    async insertBill(bill, lineItems) {
      bills.set(bill.id, cloneBill(bill));
      linesByBill.set(bill.id, lineItems.map(cloneLine));
    },

    async updateBill(bill) {
      if (bills.has(bill.id)) bills.set(bill.id, cloneBill(bill));
    },

    async getBill(tenantId, billId) {
      const bill = bills.get(billId);
      if (!bill || bill.tenantId !== tenantId) return null;
      return withLineItems(bill, linesByBill.get(bill.id) ?? []);
    },

    async findBillByRecurringOccurrence(tenantId, recurringTemplateId, billDate) {
      const bill = [...bills.values()].find(
        (candidate) =>
          candidate.tenantId === tenantId &&
          candidate.recurringTemplateId === recurringTemplateId &&
          candidate.billDate === billDate
      );
      return bill ? withLineItems(bill, linesByBill.get(bill.id) ?? []) : null;
    },

    async listBills(filter) {
      return [...bills.values()]
        .filter((bill) => matchesBillFilter(bill, filter))
        .sort((a, b) => b.billDate.localeCompare(a.billDate))
        .slice(0, filter.limit ?? 100)
        .map((bill) => withLineItems(bill, linesByBill.get(bill.id) ?? []));
    },

    async listOpenBills(tenantId, vendorId) {
      return [...bills.values()]
        .filter(
          (bill) =>
            bill.tenantId === tenantId &&
            (!vendorId || bill.vendorId === vendorId) &&
            (bill.status === "payable" || bill.status === "partial") &&
            bill.amountDueCents > 0
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((bill) => withLineItems(bill, linesByBill.get(bill.id) ?? []));
    },

    async findPaymentByIdempotencyKey(tenantId, idempotencyKey) {
      const payment = [...payments.values()].find(
        (candidate) => candidate.tenantId === tenantId && candidate.idempotencyKey === idempotencyKey
      );
      return payment ? withApplications(payment, applicationsByPayment.get(payment.id) ?? []) : null;
    },

    async getPayment(tenantId, paymentId) {
      const payment = payments.get(paymentId);
      if (!payment || payment.tenantId !== tenantId) return null;
      return withApplications(payment, applicationsByPayment.get(payment.id) ?? []);
    },

    async listPayments(filter) {
      return [...payments.values()]
        .filter((payment) => matchesPaymentFilter(payment, applicationsByPayment.get(payment.id) ?? [], filter))
        .filter((payment) => !filter.paymentDateFrom || payment.paymentDate >= filter.paymentDateFrom)
        .filter((payment) => !filter.paymentDateBefore || payment.paymentDate < filter.paymentDateBefore)
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        .slice(0, filter.limit ?? 100)
        .map((payment) => withApplications(payment, applicationsByPayment.get(payment.id) ?? []));
    },

    async insertPaymentWithApplications({ payment, applications, updatedBills }) {
      payments.set(payment.id, clonePayment(payment));
      applicationsByPayment.set(payment.id, applications.map(cloneApplication));
      for (const bill of updatedBills) {
        bills.set(bill.id, cloneBill(bill));
      }
    },

    async voidPaymentWithBillUpdates({ payment, updatedBills }) {
      if (payments.has(payment.id)) payments.set(payment.id, clonePayment(payment));
      for (const bill of updatedBills) {
        bills.set(bill.id, cloneBill(bill));
      }
    },

    async insertRecurringBillTemplate(template, lineItems) {
      recurringTemplates.set(template.id, { ...template });
      recurringLinesByTemplate.set(template.id, lineItems.map((line) => ({ ...line })));
    },

    async getRecurringBillTemplate(tenantId, templateId) {
      const template = recurringTemplates.get(templateId);
      if (!template || template.tenantId !== tenantId) return null;
      return withRecurringLineItems(template, recurringLinesByTemplate.get(template.id) ?? []);
    },

    async listRecurringBillTemplates(filter) {
      return [...recurringTemplates.values()]
        .filter((template) => matchesRecurringTemplateFilter(template, filter))
        .sort((a, b) => a.nextBillDate.localeCompare(b.nextBillDate) || a.name.localeCompare(b.name))
        .slice(0, filter.limit ?? 100)
        .map((template) => withRecurringLineItems(template, recurringLinesByTemplate.get(template.id) ?? []));
    },

    async updateRecurringBillTemplate(template) {
      if (recurringTemplates.has(template.id)) recurringTemplates.set(template.id, { ...template });
    },

    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    }
  };
}
