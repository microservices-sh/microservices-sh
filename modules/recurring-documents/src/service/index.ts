import type { RecurringDocumentsStore } from "../ports";
import type {
  CreateRecurringDocumentTemplateInput,
  GenerateDueRecurringDocumentsInput,
  GeneratedRecurringDocumentDraft,
  GenerateRecurringDocumentInput,
  ModuleResult,
  RecurringDocumentActionInput,
  RecurringDocumentGenerationResult,
  RecurringDocumentLine,
  RecurringDocumentLineInput,
  RecurringDocumentListFilter,
  RecurringDocumentStats,
  RecurringDocumentTemplate,
  RecurringDocumentsConfig,
  RecurringDocumentsIdFactory,
  RecurringDocumentsIdPrefix,
  RecurringFrequency,
  TenantContext,
  UpdateRecurringDocumentTemplateInput
} from "../types";

export interface RecurringDocumentsServiceDeps {
  store: RecurringDocumentsStore;
  createId?: RecurringDocumentsIdFactory;
  config?: RecurringDocumentsConfig;
}

export interface RecurringDocumentsService {
  createRecurringDocumentTemplate(ctx: TenantContext, input: CreateRecurringDocumentTemplateInput): Promise<ModuleResult<RecurringDocumentTemplate>>;
  updateRecurringDocumentTemplate(ctx: TenantContext, input: UpdateRecurringDocumentTemplateInput): Promise<ModuleResult<RecurringDocumentTemplate>>;
  getRecurringDocumentTemplate(ctx: TenantContext, templateId: string): Promise<ModuleResult<RecurringDocumentTemplate>>;
  listRecurringDocumentTemplates(ctx: TenantContext, filter?: RecurringDocumentListFilter): Promise<ModuleResult<{ templates: RecurringDocumentTemplate[]; total: number }>>;
  pauseRecurringDocumentTemplate(ctx: TenantContext, input: RecurringDocumentActionInput): Promise<ModuleResult<RecurringDocumentTemplate>>;
  resumeRecurringDocumentTemplate(ctx: TenantContext, input: RecurringDocumentActionInput): Promise<ModuleResult<RecurringDocumentTemplate>>;
  cancelRecurringDocumentTemplate(ctx: TenantContext, input: RecurringDocumentActionInput): Promise<ModuleResult<RecurringDocumentTemplate>>;
  generateRecurringDocument(ctx: TenantContext, input: GenerateRecurringDocumentInput): Promise<ModuleResult<{ template: RecurringDocumentTemplate; document: GeneratedRecurringDocumentDraft | null }>>;
  generateDueRecurringDocuments(ctx: TenantContext, input: GenerateDueRecurringDocumentsInput): Promise<ModuleResult<RecurringDocumentGenerationResult>>;
  getRecurringDocumentStats(ctx: TenantContext): Promise<ModuleResult<RecurringDocumentStats>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function normalizeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function now(ctx: TenantContext, at?: string | null): string {
  return normalizeDate(at ?? ctx.now ?? new Date().toISOString());
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function addFrequency(value: string, frequency: RecurringFrequency, customDays: number | null): string {
  const date = new Date(value);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  if (frequency === "quarterly") date.setUTCMonth(date.getUTCMonth() + 3);
  if (frequency === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (frequency === "custom") date.setUTCDate(date.getUTCDate() + (customDays ?? 30));
  return date.toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialRecurringDocumentsIdFactory(): RecurringDocumentsIdFactory {
  const sequences: Record<RecurringDocumentsIdPrefix, number> = { rdtpl: 0, rdln: 0, rddoc: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: RecurringDocumentsIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanCurrency(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && /^[A-Z]{3}$/.test(trimmed) ? trimmed : fallback;
}

function cleanBps(value: number | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100000 ? value : 0;
}

function cleanCents(value: number | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function cleanPositiveInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function partyTypeFor(documentType: "invoice" | "bill") {
  return documentType === "invoice" ? "customer" : "vendor";
}

function buildLines(ctx: TenantContext, templateId: string, lines: RecurringDocumentLineInput[], createId: RecurringDocumentsIdFactory): ModuleResult<RecurringDocumentLine[]> {
  if (!lines.length) return fail("template_lines_required", "Recurring document template requires at least one line.");
  const output: RecurringDocumentLine[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.description.trim()) return fail("line_description_required", "Every recurring document line requires a description.");
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) return fail("line_quantity_invalid", "Line quantity must be greater than zero.");
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) return fail("line_unit_price_invalid", "Line unit price must be a non-negative integer number of cents.");
    output.push({
      id: createId("rdln"),
      tenantId: ctx.tenantId,
      templateId,
      productId: cleanText(line.productId),
      expenseAccountId: cleanText(line.expenseAccountId),
      description: line.description.trim(),
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: Math.round(line.quantity * line.unitPriceCents),
      sortOrder: index
    });
  }
  return ok(output);
}

function calculateTotals(lines: RecurringDocumentLine[], taxBasisPoints: number, discountCents: number) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (discountCents > subtotalCents) return null;
  const taxableCents = subtotalCents - discountCents;
  const taxCents = Math.round((taxableCents * taxBasisPoints) / 10000);
  return { subtotalCents, taxCents, totalCents: taxableCents + taxCents };
}

function shouldCompleteBeforeGeneration(template: RecurringDocumentTemplate, asOf: string): boolean {
  if (template.maxOccurrences !== null && template.occurrencesGenerated >= template.maxOccurrences) return true;
  if (template.endDate !== null && template.endDate < asOf) return true;
  return false;
}

function createDraft(template: RecurringDocumentTemplate, documentId: string, issueDate: string): GeneratedRecurringDocumentDraft {
  return {
    id: documentId,
    tenantId: template.tenantId,
    sourceTemplateId: template.id,
    sourceTemplateName: template.name,
    documentType: template.documentType,
    partyType: template.partyType,
    partyId: template.partyId,
    status: template.documentType === "bill" && template.autoApprove ? "approved" : "draft",
    issueDate,
    dueDate: addDays(issueDate, template.paymentTermsDays),
    subtotalCents: template.subtotalCents,
    taxBasisPoints: template.taxBasisPoints,
    taxCents: template.taxCents,
    discountCents: template.discountCents,
    totalCents: template.totalCents,
    amountPaidCents: 0,
    amountDueCents: template.totalCents,
    currency: template.currency,
    notes: template.notes,
    terms: template.terms,
    autoSend: template.autoSend,
    autoApprove: template.autoApprove,
    incomeAccountId: template.incomeAccountId,
    arAccountId: template.arAccountId,
    expenseAccountId: template.expenseAccountId,
    apAccountId: template.apAccountId,
    lines: template.lines.map((line) => ({
      productId: line.productId,
      expenseAccountId: line.expenseAccountId,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      sortOrder: line.sortOrder
    }))
  };
}

export function createRecurringDocumentsService(deps: RecurringDocumentsServiceDeps): RecurringDocumentsService {
  const createId = deps.createId ?? defaultId;
  const defaultCurrency = cleanCurrency(deps.config?.defaultCurrency, "USD");
  const defaultPaymentTermsDays = deps.config?.defaultPaymentTermsDays ?? 30;

  async function requireTemplate(ctx: TenantContext, templateId: string): Promise<ModuleResult<RecurringDocumentTemplate>> {
    if (!templateId.trim()) return fail("template_id_required", "Recurring document template id is required.");
    const template = await deps.store.getTemplate(ctx.tenantId, templateId);
    return template ? ok(template) : fail("template_not_found", "Recurring document template was not found.");
  }

  async function generateOne(ctx: TenantContext, template: RecurringDocumentTemplate, asOf: string, documentId?: string | null) {
    if (template.status !== "active") return { template, document: null, completed: false };
    const timestamp = now(ctx, asOf);
    if (shouldCompleteBeforeGeneration(template, timestamp)) {
      const completed = { ...template, status: "completed" as const, nextRunDate: null, updatedById: ctx.actorId ?? null, updatedAt: timestamp };
      await deps.store.updateTemplate(completed);
      return { template: completed, document: null, completed: true };
    }
    const draft = createDraft(template, documentId?.trim() || createId("rddoc"), timestamp);
    const occurrencesGenerated = template.occurrencesGenerated + 1;
    const nextRunDate = addFrequency(template.nextRunDate ?? timestamp, template.frequency, template.customDays);
    const completedAfterRun =
      (template.maxOccurrences !== null && occurrencesGenerated >= template.maxOccurrences) ||
      (template.endDate !== null && nextRunDate > template.endDate);
    const updated = {
      ...template,
      status: completedAfterRun ? "completed" as const : "active" as const,
      lastRunDate: timestamp,
      nextRunDate: completedAfterRun ? null : nextRunDate,
      occurrencesGenerated,
      updatedById: ctx.actorId ?? null,
      updatedAt: timestamp
    };
    await deps.store.updateTemplate(updated);
    return { template: updated, document: draft, completed: completedAfterRun };
  }

  return {
    async createRecurringDocumentTemplate(ctx, input) {
      if (!input.name.trim()) return fail("template_name_required", "Recurring document template name is required.");
      if (!input.partyId.trim()) return fail("party_required", "Recurring document template requires a customer or vendor id.");
      if (input.frequency === "custom" && !cleanPositiveInteger(input.customDays)) return fail("custom_days_required", "Custom recurrence requires a positive custom day interval.");
      const createdAt = now(ctx);
      const templateId = createId("rdtpl");
      const linesResult = buildLines(ctx, templateId, input.lines, createId);
      if (!linesResult.ok || !linesResult.data) return fail(linesResult.error?.code ?? "template_lines_invalid", linesResult.error?.message ?? "Recurring document lines are invalid.");
      const taxBasisPoints = cleanBps(input.taxBasisPoints);
      const discountCents = cleanCents(input.discountCents);
      const totals = calculateTotals(linesResult.data, taxBasisPoints, discountCents);
      if (!totals) return fail("discount_exceeds_subtotal", "Recurring document discount cannot exceed subtotal.");
      const startDate = normalizeDate(input.startDate ?? createdAt);
      const template: RecurringDocumentTemplate = {
        id: templateId,
        tenantId: ctx.tenantId,
        name: input.name.trim(),
        documentType: input.documentType,
        partyType: partyTypeFor(input.documentType),
        partyId: input.partyId.trim(),
        frequency: input.frequency,
        customDays: input.frequency === "custom" ? cleanPositiveInteger(input.customDays) : null,
        status: "active",
        startDate,
        endDate: input.endDate === null ? null : input.endDate ? normalizeDate(input.endDate) : null,
        nextRunDate: startDate,
        lastRunDate: null,
        paymentTermsDays: cleanPositiveInteger(input.paymentTermsDays) ?? defaultPaymentTermsDays,
        maxOccurrences: cleanPositiveInteger(input.maxOccurrences),
        occurrencesGenerated: 0,
        subtotalCents: totals.subtotalCents,
        taxBasisPoints,
        taxCents: totals.taxCents,
        discountCents,
        totalCents: totals.totalCents,
        currency: cleanCurrency(input.currency, defaultCurrency),
        notes: cleanText(input.notes),
        terms: cleanText(input.terms),
        incomeAccountId: cleanText(input.incomeAccountId),
        arAccountId: cleanText(input.arAccountId),
        expenseAccountId: cleanText(input.expenseAccountId),
        apAccountId: cleanText(input.apAccountId),
        autoSend: input.autoSend ?? false,
        autoApprove: input.autoApprove ?? false,
        createdById: cleanText(input.createdById ?? ctx.actorId),
        updatedById: null,
        createdAt,
        updatedAt: createdAt,
        lines: linesResult.data
      };
      await deps.store.insertTemplate(template);
      return ok(template);
    },

    async updateRecurringDocumentTemplate(ctx, input) {
      const currentResult = await requireTemplate(ctx, input.templateId);
      if (!currentResult.ok || !currentResult.data) return currentResult;
      const current = currentResult.data;
      if (current.status === "completed" || current.status === "cancelled") return fail("template_not_editable", "Completed or cancelled recurring document templates cannot be edited.");
      const updatedAt = now(ctx);
      const lines = input.lines ? buildLines(ctx, current.id, input.lines, createId) : ok(current.lines.map((line) => ({ ...line })));
      if (!lines.ok || !lines.data) return fail(lines.error?.code ?? "template_lines_invalid", lines.error?.message ?? "Recurring document lines are invalid.");
      const taxBasisPoints = input.taxBasisPoints === undefined ? current.taxBasisPoints : cleanBps(input.taxBasisPoints);
      const discountCents = input.discountCents === undefined ? current.discountCents : cleanCents(input.discountCents);
      const totals = calculateTotals(lines.data, taxBasisPoints, discountCents);
      if (!totals) return fail("discount_exceeds_subtotal", "Recurring document discount cannot exceed subtotal.");
      const frequency = input.frequency ?? current.frequency;
      const customDays = frequency === "custom" ? cleanPositiveInteger(input.customDays ?? current.customDays) : null;
      if (frequency === "custom" && !customDays) return fail("custom_days_required", "Custom recurrence requires a positive custom day interval.");
      const startDate = input.startDate ? normalizeDate(input.startDate) : current.startDate;
      const template: RecurringDocumentTemplate = {
        ...current,
        name: input.name?.trim() || current.name,
        partyId: input.partyId?.trim() || current.partyId,
        frequency,
        customDays,
        startDate,
        endDate: input.endDate === undefined ? current.endDate : input.endDate === null ? null : normalizeDate(input.endDate),
        nextRunDate: current.lastRunDate ? current.nextRunDate : startDate,
        paymentTermsDays: cleanPositiveInteger(input.paymentTermsDays) ?? current.paymentTermsDays,
        maxOccurrences: input.maxOccurrences === undefined ? current.maxOccurrences : cleanPositiveInteger(input.maxOccurrences),
        taxBasisPoints,
        discountCents,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        currency: input.currency ? cleanCurrency(input.currency, current.currency) : current.currency,
        notes: input.notes === undefined ? current.notes : cleanText(input.notes),
        terms: input.terms === undefined ? current.terms : cleanText(input.terms),
        incomeAccountId: input.incomeAccountId === undefined ? current.incomeAccountId : cleanText(input.incomeAccountId),
        arAccountId: input.arAccountId === undefined ? current.arAccountId : cleanText(input.arAccountId),
        expenseAccountId: input.expenseAccountId === undefined ? current.expenseAccountId : cleanText(input.expenseAccountId),
        apAccountId: input.apAccountId === undefined ? current.apAccountId : cleanText(input.apAccountId),
        autoSend: input.autoSend ?? current.autoSend,
        autoApprove: input.autoApprove ?? current.autoApprove,
        updatedById: cleanText(input.updatedById ?? ctx.actorId),
        updatedAt,
        lines: lines.data
      };
      await deps.store.updateTemplate(template);
      return ok(template);
    },

    async getRecurringDocumentTemplate(ctx, templateId) {
      return requireTemplate(ctx, templateId);
    },

    async listRecurringDocumentTemplates(ctx, filter) {
      return ok(await deps.store.listTemplates(ctx.tenantId, filter));
    },

    async pauseRecurringDocumentTemplate(ctx, input) {
      const result = await requireTemplate(ctx, input.templateId);
      if (!result.ok || !result.data) return result;
      if (result.data.status !== "active") return fail("template_not_pausable", "Only active recurring document templates can be paused.");
      const timestamp = now(ctx, input.at);
      const template = { ...result.data, status: "paused" as const, updatedById: cleanText(input.actorId ?? ctx.actorId), updatedAt: timestamp };
      await deps.store.updateTemplate(template);
      return ok(template);
    },

    async resumeRecurringDocumentTemplate(ctx, input) {
      const result = await requireTemplate(ctx, input.templateId);
      if (!result.ok || !result.data) return result;
      if (result.data.status !== "paused") return fail("template_not_resumable", "Only paused recurring document templates can be resumed.");
      const timestamp = now(ctx, input.at);
      const nextRunDate = result.data.nextRunDate && result.data.nextRunDate > timestamp ? result.data.nextRunDate : timestamp;
      const template = { ...result.data, status: "active" as const, nextRunDate, updatedById: cleanText(input.actorId ?? ctx.actorId), updatedAt: timestamp };
      await deps.store.updateTemplate(template);
      return ok(template);
    },

    async cancelRecurringDocumentTemplate(ctx, input) {
      const result = await requireTemplate(ctx, input.templateId);
      if (!result.ok || !result.data) return result;
      if (result.data.status === "completed") return fail("template_already_completed", "Completed recurring document templates cannot be cancelled.");
      if (result.data.status === "cancelled") return ok(result.data);
      const timestamp = now(ctx, input.at);
      const template = { ...result.data, status: "cancelled" as const, nextRunDate: null, updatedById: cleanText(input.actorId ?? ctx.actorId), updatedAt: timestamp };
      await deps.store.updateTemplate(template);
      return ok(template);
    },

    async generateRecurringDocument(ctx, input) {
      const result = await requireTemplate(ctx, input.templateId);
      if (!result.ok || !result.data) return fail(result.error?.code ?? "template_not_found", result.error?.message ?? "Recurring document template was not found.");
      const generated = await generateOne(ctx, result.data, now(ctx, input.at), input.documentId);
      return ok({ template: generated.template, document: generated.document });
    },

    async generateDueRecurringDocuments(ctx, input) {
      const due = await deps.store.listDueTemplates(ctx.tenantId, normalizeDate(input.asOf), input.limit);
      const generated: GeneratedRecurringDocumentDraft[] = [];
      const completedTemplateIds: string[] = [];
      for (const template of due) {
        const result = await generateOne(ctx, template, input.asOf);
        if (result.document) generated.push(result.document);
        if (result.completed) completedTemplateIds.push(result.template.id);
      }
      return ok({ generated, completedTemplateIds });
    },

    async getRecurringDocumentStats(ctx) {
      const asOf = now(ctx);
      const { templates } = await deps.store.listTemplates(ctx.tenantId, { limit: 100000 });
      const stats: RecurringDocumentStats = { active: 0, paused: 0, completed: 0, cancelled: 0, totalValueCents: 0, dueValueCents: 0 };
      for (const template of templates) {
        stats[template.status] += 1;
        stats.totalValueCents += template.totalCents;
        if (template.status === "active" && template.nextRunDate !== null && template.nextRunDate <= asOf) stats.dueValueCents += template.totalCents;
      }
      return ok(stats);
    }
  };
}

export function getRecurringDocumentsModuleStatus() {
  return { id: "recurring-documents", status: "draft" } as const;
}
