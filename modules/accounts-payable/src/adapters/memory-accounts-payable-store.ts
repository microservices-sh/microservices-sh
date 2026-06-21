import type { AccountsPayableStore } from "../ports";
import type {
  AccountsPayableEvent,
  Bill,
  BillFilter,
  BillLineItem,
  BillPayment,
  BillPaymentApplication,
  BillPaymentWithApplications,
  BillWithLineItems,
  RecurringBillLineItem,
  RecurringBillTemplate,
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

function matchesBillFilter(bill: Bill, filter: BillFilter): boolean {
  return (
    bill.tenantId === filter.tenantId &&
    (!filter.vendorId || bill.vendorId === filter.vendorId) &&
    (!filter.status || bill.status === filter.status) &&
    (!filter.statuses || filter.statuses.includes(bill.status))
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

    async insertPaymentWithApplications({ payment, applications, updatedBills }) {
      payments.set(payment.id, clonePayment(payment));
      applicationsByPayment.set(payment.id, applications.map(cloneApplication));
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
      return {
        ...template,
        lineItems: (recurringLinesByTemplate.get(template.id) ?? []).map((line) => ({ ...line }))
      };
    },

    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    }
  };
}
