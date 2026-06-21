export interface RecurringDocumentsConfig {
  enabled: boolean;
  defaultCurrency?: string;
  defaultPaymentTermsDays?: number;
}

export type RecurringDocumentsIdPrefix = "rdtpl" | "rdln" | "rddoc";
export type RecurringDocumentsIdFactory = (prefix: RecurringDocumentsIdPrefix) => string;
export type RecurringDocumentType = "invoice" | "bill";
export type RecurringPartyType = "customer" | "vendor";
export type RecurringTemplateStatus = "active" | "paused" | "completed" | "cancelled";
export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface RecurringDocumentLine {
  id: string;
  tenantId: string;
  templateId: string;
  productId: string | null;
  expenseAccountId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sortOrder: number;
}

export interface RecurringDocumentTemplate {
  id: string;
  tenantId: string;
  name: string;
  documentType: RecurringDocumentType;
  partyType: RecurringPartyType;
  partyId: string;
  frequency: RecurringFrequency;
  customDays: number | null;
  status: RecurringTemplateStatus;
  startDate: string;
  endDate: string | null;
  nextRunDate: string | null;
  lastRunDate: string | null;
  paymentTermsDays: number;
  maxOccurrences: number | null;
  occurrencesGenerated: number;
  subtotalCents: number;
  taxBasisPoints: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  incomeAccountId: string | null;
  arAccountId: string | null;
  expenseAccountId: string | null;
  apAccountId: string | null;
  autoSend: boolean;
  autoApprove: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  lines: RecurringDocumentLine[];
}

export interface RecurringDocumentLineInput {
  productId?: string | null;
  expenseAccountId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreateRecurringDocumentTemplateInput {
  name: string;
  documentType: RecurringDocumentType;
  partyId: string;
  frequency: RecurringFrequency;
  customDays?: number | null;
  startDate?: string;
  endDate?: string | null;
  paymentTermsDays?: number;
  maxOccurrences?: number | null;
  taxBasisPoints?: number;
  discountCents?: number;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  incomeAccountId?: string | null;
  arAccountId?: string | null;
  expenseAccountId?: string | null;
  apAccountId?: string | null;
  autoSend?: boolean;
  autoApprove?: boolean;
  createdById?: string | null;
  lines: RecurringDocumentLineInput[];
}

export interface UpdateRecurringDocumentTemplateInput extends Partial<Omit<CreateRecurringDocumentTemplateInput, "documentType" | "lines">> {
  templateId: string;
  lines?: RecurringDocumentLineInput[];
  updatedById?: string | null;
}

export interface RecurringDocumentActionInput {
  templateId: string;
  actorId?: string | null;
  at?: string;
}

export interface GenerateRecurringDocumentInput extends RecurringDocumentActionInput {
  documentId?: string | null;
}

export interface GenerateDueRecurringDocumentsInput {
  asOf: string;
  limit?: number;
}

export interface RecurringDocumentListFilter {
  documentType?: RecurringDocumentType;
  partyId?: string;
  status?: RecurringTemplateStatus;
  dueBefore?: string;
  limit?: number;
  offset?: number;
}

export interface GeneratedRecurringDocumentDraft {
  id: string;
  tenantId: string;
  sourceTemplateId: string;
  sourceTemplateName: string;
  documentType: RecurringDocumentType;
  partyType: RecurringPartyType;
  partyId: string;
  status: "draft" | "approved";
  issueDate: string;
  dueDate: string;
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
  autoSend: boolean;
  autoApprove: boolean;
  incomeAccountId: string | null;
  arAccountId: string | null;
  expenseAccountId: string | null;
  apAccountId: string | null;
  lines: Array<{
    productId: string | null;
    expenseAccountId: string | null;
    description: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    sortOrder: number;
  }>;
}

export interface RecurringDocumentGenerationResult {
  generated: GeneratedRecurringDocumentDraft[];
  completedTemplateIds: string[];
}

export interface RecurringDocumentStats {
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
  totalValueCents: number;
  dueValueCents: number;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
