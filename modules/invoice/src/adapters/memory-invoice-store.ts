import type { InvoiceStore } from "../ports";
import type { Invoice, InvoiceLineItem } from "../types";

export function createMemoryInvoiceStore(): InvoiceStore {
  const invoices = new Map<string, Invoice>();
  const lineItems: InvoiceLineItem[] = [];
  const paymentKeys = new Set<string>();

  return {
    async insert(invoice) {
      invoices.set(invoice.id, { ...invoice });
    },
    async get(id) {
      const invoice = invoices.get(id);
      return invoice ? { ...invoice } : null;
    },
    async update(invoice) {
      if (invoices.has(invoice.id)) invoices.set(invoice.id, { ...invoice });
    },
    async list(filter) {
      return [...invoices.values()]
        .filter(
          (inv) =>
            inv.tenantId === filter.tenantId &&
            (!filter.customerId || inv.customerId === filter.customerId) &&
            (!filter.status || inv.status === filter.status)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map((inv) => ({ ...inv }));
    },
    async findByRecurringOccurrence(tenantId, recurringTemplateId, recurringOccurrenceAt) {
      const invoice = [...invoices.values()].find(
        (inv) =>
          inv.tenantId === tenantId &&
          inv.recurringTemplateId === recurringTemplateId &&
          inv.recurringOccurrenceAt === recurringOccurrenceAt
      );
      return invoice ? { ...invoice } : null;
    },
    async listOverdue(nowIso, limit) {
      return [...invoices.values()]
        .filter((inv) => inv.status === "open" && inv.dueAt !== null && inv.dueAt <= nowIso)
        .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
        .slice(0, limit)
        .map((inv) => ({ ...inv }));
    },

    async insertLineItem(item) {
      lineItems.push({ ...item });
    },
    async listLineItems(invoiceId) {
      return lineItems.filter((li) => li.invoiceId === invoiceId).map((li) => ({ ...li }));
    },

    async recordPaymentKey(invoiceId, key) {
      const composite = `${invoiceId}:${key}`;
      if (paymentKeys.has(composite)) return false;
      paymentKeys.add(composite);
      return true;
    }
  };
}
