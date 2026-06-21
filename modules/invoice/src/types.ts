// Lifecycle: draft -> open (issued, numbered, frozen) -> paid | void.
// Editing is only allowed while draft. After issue the document is immutable;
// corrections are made by voiding and reissuing, never by mutating in place.
export type InvoiceStatus = "draft" | "open" | "paid" | "void";
export type RecurringInvoiceFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type RecurringInvoiceStatus = "active" | "paused" | "cancelled" | "completed";

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  // Integer quantity; money is integer cents to avoid float drift.
  quantity: number;
  unitAmountCents: number;
  // Tax rate in basis points (e.g. 875 = 8.75%).
  taxRateBps: number;
  // quantity * unitAmountCents (pre-tax).
  amountCents: number;
}

export interface Invoice {
  id: string;
  // Assigned atomically at issue time; null while draft. Gapless per series.
  number: string | null;
  series: string;
  tenantId: string;
  customerId: string;
  status: InvoiceStatus;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  notes: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  paymentLinkId: string | null;
  paymentLinkUrl: string | null;
  paymentLinkProvider: string | null;
  paymentLinkCreatedAt: string | null;
  recurringTemplateId: string | null;
  recurringOccurrenceAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceWithLines extends Invoice {
  lineItems: InvoiceLineItem[];
}

export interface InvoiceFilter {
  tenantId: string;
  customerId?: string;
  status?: InvoiceStatus;
  limit?: number;
}

export interface InvoiceTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export interface RecurringInvoiceTemplate {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  series: string;
  currency: string;
  frequency: RecurringInvoiceFrequency;
  customDays: number | null;
  status: RecurringInvoiceStatus;
  startAt: string;
  endAt: string | null;
  nextInvoiceAt: string | null;
  lastInvoiceAt: string | null;
  paymentTermsDays: number;
  maxOccurrences: number | null;
  invoicesGenerated: number;
  autoIssue: boolean;
  notes: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringInvoiceTemplateLineItem {
  id: string;
  templateId: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  taxRateBps: number;
  amountCents: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringInvoiceTemplateWithLineItems extends RecurringInvoiceTemplate {
  lineItems: RecurringInvoiceTemplateLineItem[];
}

export interface RecurringInvoiceTemplateFilter {
  tenantId: string;
  customerId?: string;
  status?: RecurringInvoiceStatus;
  statuses?: RecurringInvoiceStatus[];
  dueOnOrBefore?: string;
  limit?: number;
}

// A domain event the module emits. correlationId is threaded from the use-case
// meta so downstream consumers can stitch the causal chain. See Plan 25 §4.
export interface DomainEvent {
  name: string;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}
