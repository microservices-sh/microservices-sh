import type {
  Invoice,
  InvoiceFilter,
  InvoiceLineItem,
  RecurringInvoiceTemplate,
  RecurringInvoiceTemplateFilter,
  RecurringInvoiceTemplateLineItem,
  RecurringInvoiceTemplateWithLineItems
} from "../types";

export interface InvoiceStore {
  insert(invoice: Invoice): Promise<void>;
  get(id: string): Promise<Invoice | null>;
  update(invoice: Invoice): Promise<void>;
  list(filter: InvoiceFilter): Promise<Invoice[]>;
  findByRecurringOccurrence(
    tenantId: string,
    recurringTemplateId: string,
    recurringOccurrenceAt: string
  ): Promise<Invoice | null>;
  // Open invoices past dueAt — drives dunning/reminders.
  listOverdue(nowIso: string, limit: number): Promise<Invoice[]>;

  insertLineItem(item: InvoiceLineItem): Promise<void>;
  listLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;

  // Idempotent payment ledger: returns false if this key was already applied.
  recordPaymentKey(invoiceId: string, key: string): Promise<boolean>;
}

export interface RecurringInvoiceStore {
  insertTemplate(
    template: RecurringInvoiceTemplate,
    lineItems: RecurringInvoiceTemplateLineItem[]
  ): Promise<void>;
  getTemplate(tenantId: string, templateId: string): Promise<RecurringInvoiceTemplateWithLineItems | null>;
  listTemplates(filter: RecurringInvoiceTemplateFilter): Promise<RecurringInvoiceTemplateWithLineItems[]>;
  updateTemplate(template: RecurringInvoiceTemplate): Promise<void>;
}

// Allocates gapless, monotonically increasing numbers per series. The
// implementation MUST be atomic under concurrency — that is the whole point.
// MAX(number)+1 in app code is the classic agent bug this port exists to prevent.
export interface NumberAllocator {
  allocate(series: string): Promise<number>;
}

export interface InvoicePaymentLinkProvider {
  createPaymentLink(input: {
    invoiceId: string;
    invoiceNumber: string;
    amountCents: number;
    currency: string;
    customerId: string;
    customerEmail?: string;
    description: string;
    successUrl?: string;
    idempotencyKey: string;
  }): Promise<{ id: string; url: string; provider: string }>;
}
