export interface EstimateQuoteConfig {
  enabled: boolean;
  defaultCurrency?: string;
  quoteNumberPrefix?: string;
  defaultExpiryDays?: number;
}

export type EstimateQuoteIdPrefix = "eq" | "eqln";
export type EstimateQuoteIdFactory = (prefix: EstimateQuoteIdPrefix) => string;
export type EstimateQuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "converted" | "void";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface EstimateQuoteLine {
  id: string;
  tenantId: string;
  quoteId: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sortOrder: number;
}

export interface EstimateQuote {
  id: string;
  tenantId: string;
  quoteNumber: string;
  clientId: string;
  status: EstimateQuoteStatus;
  issueDate: string;
  expiryDate: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;
  convertedAt: string | null;
  voidedAt: string | null;
  subtotalCents: number;
  taxBasisPoints: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  convertedToInvoiceId: string | null;
  pdfKey: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  lines: EstimateQuoteLine[];
}

export interface EstimateQuoteLineInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreateEstimateQuoteInput {
  quoteNumber?: string;
  clientId: string;
  issueDate?: string;
  expiryDate?: string | null;
  taxBasisPoints?: number;
  discountCents?: number;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  pdfKey?: string | null;
  createdById?: string | null;
  lines: EstimateQuoteLineInput[];
}

export interface UpdateEstimateQuoteInput {
  quoteId: string;
  clientId?: string;
  issueDate?: string;
  expiryDate?: string | null;
  taxBasisPoints?: number;
  discountCents?: number;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  pdfKey?: string | null;
  updatedById?: string | null;
  lines?: EstimateQuoteLineInput[];
}

export interface EstimateQuoteActionInput {
  quoteId: string;
  actorId?: string | null;
  at?: string;
}

export interface DeclineEstimateQuoteInput extends EstimateQuoteActionInput {
  reason?: string | null;
}

export interface VoidEstimateQuoteInput extends EstimateQuoteActionInput {
  reason?: string | null;
}

export interface ConvertEstimateQuoteInput extends EstimateQuoteActionInput {
  invoiceId: string;
}

export interface ExpireEstimateQuotesInput {
  asOf: string;
  limit?: number;
}

export interface EstimateQuoteListFilter {
  status?: EstimateQuoteStatus;
  clientId?: string;
  numberSearch?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  limit?: number;
  offset?: number;
}

export interface EstimateQuoteStats {
  draft: number;
  sent: number;
  accepted: number;
  declined: number;
  expired: number;
  converted: number;
  void: number;
  totalValueCents: number;
  pendingValueCents: number;
  acceptedValueCents: number;
  convertedValueCents: number;
  conversionRateBasisPoints: number;
}

export interface InvoiceDraftFromEstimate {
  sourceQuoteId: string;
  sourceQuoteNumber: string;
  invoiceId: string | null;
  clientId: string;
  issueDate: string;
  dueDate: string | null;
  subtotalCents: number;
  taxBasisPoints: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  lines: Array<{
    productId: string | null;
    description: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    sortOrder: number;
  }>;
}

export interface EstimateQuoteConversion {
  quote: EstimateQuote;
  invoiceDraft: InvoiceDraftFromEstimate;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
