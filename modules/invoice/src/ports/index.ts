import type { Invoice, InvoiceFilter, InvoiceLineItem } from "../types";

export interface InvoiceStore {
  insert(invoice: Invoice): Promise<void>;
  get(id: string): Promise<Invoice | null>;
  update(invoice: Invoice): Promise<void>;
  list(filter: InvoiceFilter): Promise<Invoice[]>;
  // Open invoices past dueAt — drives dunning/reminders.
  listOverdue(nowIso: string, limit: number): Promise<Invoice[]>;

  insertLineItem(item: InvoiceLineItem): Promise<void>;
  listLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;

  // Idempotent payment ledger: returns false if this key was already applied.
  recordPaymentKey(invoiceId: string, key: string): Promise<boolean>;
}

// Allocates gapless, monotonically increasing numbers per series. The
// implementation MUST be atomic under concurrency — that is the whole point.
// MAX(number)+1 in app code is the classic agent bug this port exists to prevent.
export interface NumberAllocator {
  allocate(series: string): Promise<number>;
}
