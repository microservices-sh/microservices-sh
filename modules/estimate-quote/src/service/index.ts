import type { EstimateQuoteStore } from "../ports";
import type {
  ConvertEstimateQuoteInput,
  CreateEstimateQuoteInput,
  DeclineEstimateQuoteInput,
  EstimateQuote,
  EstimateQuoteActionInput,
  EstimateQuoteConfig,
  EstimateQuoteConversion,
  EstimateQuoteIdFactory,
  EstimateQuoteIdPrefix,
  EstimateQuoteLine,
  EstimateQuoteLineInput,
  EstimateQuoteListFilter,
  EstimateQuoteStats,
  ExpireEstimateQuotesInput,
  InvoiceDraftFromEstimate,
  ModuleResult,
  TenantContext,
  UpdateEstimateQuoteInput,
  VoidEstimateQuoteInput
} from "../types";

export interface EstimateQuoteServiceDeps {
  store: EstimateQuoteStore;
  createId?: EstimateQuoteIdFactory;
  config?: EstimateQuoteConfig;
}

export interface EstimateQuoteService {
  createEstimateQuote(ctx: TenantContext, input: CreateEstimateQuoteInput): Promise<ModuleResult<EstimateQuote>>;
  updateEstimateQuote(ctx: TenantContext, input: UpdateEstimateQuoteInput): Promise<ModuleResult<EstimateQuote>>;
  getEstimateQuote(ctx: TenantContext, quoteId: string): Promise<ModuleResult<EstimateQuote>>;
  listEstimateQuotes(ctx: TenantContext, filter?: EstimateQuoteListFilter): Promise<ModuleResult<{ quotes: EstimateQuote[]; total: number }>>;
  sendEstimateQuote(ctx: TenantContext, input: EstimateQuoteActionInput): Promise<ModuleResult<EstimateQuote>>;
  markEstimateQuoteViewed(ctx: TenantContext, input: EstimateQuoteActionInput): Promise<ModuleResult<EstimateQuote>>;
  acceptEstimateQuote(ctx: TenantContext, input: EstimateQuoteActionInput): Promise<ModuleResult<EstimateQuote>>;
  declineEstimateQuote(ctx: TenantContext, input: DeclineEstimateQuoteInput): Promise<ModuleResult<EstimateQuote>>;
  voidEstimateQuote(ctx: TenantContext, input: VoidEstimateQuoteInput): Promise<ModuleResult<EstimateQuote>>;
  expireEstimateQuotes(ctx: TenantContext, input: ExpireEstimateQuotesInput): Promise<ModuleResult<EstimateQuote[]>>;
  prepareInvoiceDraft(ctx: TenantContext, quoteId: string, invoiceId?: string | null): Promise<ModuleResult<InvoiceDraftFromEstimate>>;
  convertEstimateQuote(ctx: TenantContext, input: ConvertEstimateQuoteInput): Promise<ModuleResult<EstimateQuoteConversion>>;
  getEstimateQuoteStats(ctx: TenantContext): Promise<ModuleResult<EstimateQuoteStats>>;
}

const STATUS_KEYS = ["draft", "sent", "accepted", "declined", "expired", "converted", "void"] as const;

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function timestamp(ctx: TenantContext, at?: string | null): string {
  return normalizeDate(at ?? ctx.now ?? new Date().toISOString());
}

function normalizeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialEstimateQuoteIdFactory(): EstimateQuoteIdFactory {
  const sequences: Record<EstimateQuoteIdPrefix, number> = { eq: 0, eqln: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: EstimateQuoteIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid?.replaceAll("-", "") ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
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

function normalizeQuoteNumber(input: string): string {
  return input.trim().toUpperCase();
}

function parseQuoteSequence(quoteNumber: string, prefix: string): number {
  const normalizedPrefix = normalizeQuoteNumber(prefix);
  const match = quoteNumber.match(new RegExp(`^${normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
}

async function nextQuoteNumber(store: EstimateQuoteStore, tenantId: string, prefix: string): Promise<string> {
  const normalizedPrefix = normalizeQuoteNumber(prefix || "EST");
  const latest = await store.getLatestQuoteNumber(tenantId, normalizedPrefix);
  const next = latest ? parseQuoteSequence(latest, normalizedPrefix) + 1 : 1;
  return `${normalizedPrefix}-${String(next).padStart(5, "0")}`;
}

function buildLines(ctx: TenantContext, quoteId: string, lines: EstimateQuoteLineInput[], createId: EstimateQuoteIdFactory): ModuleResult<EstimateQuoteLine[]> {
  if (!lines.length) return fail("quote_lines_required", "Estimate quote requires at least one line item.");
  const output: EstimateQuoteLine[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.description.trim()) return fail("line_description_required", "Every estimate quote line requires a description.");
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) return fail("line_quantity_invalid", "Line quantity must be greater than zero.");
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) return fail("line_unit_price_invalid", "Line unit price must be a non-negative integer number of cents.");
    output.push({
      id: createId("eqln"),
      tenantId: ctx.tenantId,
      quoteId,
      productId: cleanText(line.productId),
      description: line.description.trim(),
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: Math.round(line.quantity * line.unitPriceCents),
      sortOrder: index
    });
  }
  return ok(output);
}

function calculateTotals(lines: EstimateQuoteLine[], taxBasisPoints: number, discountCents: number) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (discountCents > subtotalCents) return null;
  const taxableCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round((taxableCents * taxBasisPoints) / 10000);
  return {
    subtotalCents,
    taxCents,
    totalCents: taxableCents + taxCents
  };
}

function isPending(status: EstimateQuote["status"]): boolean {
  return status === "sent" || status === "viewed";
}

function isExpired(quote: EstimateQuote, asOf: string): boolean {
  return Boolean(quote.expiryDate && isPending(quote.status) && quote.expiryDate < normalizeDate(asOf));
}

function toInvoiceDraft(quote: EstimateQuote, invoiceId: string | null, issueDate: string): InvoiceDraftFromEstimate {
  return {
    sourceQuoteId: quote.id,
    sourceQuoteNumber: quote.quoteNumber,
    invoiceId,
    clientId: quote.clientId,
    issueDate,
    dueDate: null,
    subtotalCents: quote.subtotalCents,
    taxBasisPoints: quote.taxBasisPoints,
    taxCents: quote.taxCents,
    discountCents: quote.discountCents,
    totalCents: quote.totalCents,
    amountPaidCents: 0,
    amountDueCents: quote.totalCents,
    currency: quote.currency,
    notes: quote.notes,
    terms: quote.terms,
    lines: quote.lines.map((line) => ({
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      sortOrder: line.sortOrder
    }))
  };
}

export function createEstimateQuoteService(deps: EstimateQuoteServiceDeps): EstimateQuoteService {
  const createId = deps.createId ?? defaultId;
  const defaultCurrency = cleanCurrency(deps.config?.defaultCurrency, "USD");
  const quoteNumberPrefix = deps.config?.quoteNumberPrefix ?? "EST";
  const defaultExpiryDays = deps.config?.defaultExpiryDays ?? 30;

  async function requireQuote(ctx: TenantContext, quoteId: string): Promise<ModuleResult<EstimateQuote>> {
    if (!quoteId.trim()) return fail("quote_id_required", "Estimate quote id is required.");
    const quote = await deps.store.getQuote(ctx.tenantId, quoteId);
    return quote ? ok(quote) : fail("quote_not_found", "Estimate quote was not found.");
  }

  return {
    async createEstimateQuote(ctx, input) {
      if (!input.clientId.trim()) return fail("client_required", "Estimate quote requires a client id.");
      const createdAt = timestamp(ctx);
      const quoteId = createId("eq");
      const quoteNumber = input.quoteNumber ? normalizeQuoteNumber(input.quoteNumber) : await nextQuoteNumber(deps.store, ctx.tenantId, quoteNumberPrefix);
      if (!quoteNumber) return fail("quote_number_required", "Estimate quote number is required.");
      if (await deps.store.getQuoteByNumber(ctx.tenantId, quoteNumber)) return fail("quote_number_exists", "Estimate quote number already exists.");
      const linesResult = buildLines(ctx, quoteId, input.lines, createId);
      if (!linesResult.ok || !linesResult.data) return fail(linesResult.error?.code ?? "quote_lines_invalid", linesResult.error?.message ?? "Estimate quote lines are invalid.");
      const taxBasisPoints = cleanBps(input.taxBasisPoints);
      const discountCents = cleanCents(input.discountCents);
      const totals = calculateTotals(linesResult.data, taxBasisPoints, discountCents);
      if (!totals) return fail("discount_exceeds_subtotal", "Estimate quote discount cannot exceed subtotal.");
      const issueDate = normalizeDate(input.issueDate ?? createdAt);
      const quote: EstimateQuote = {
        id: quoteId,
        tenantId: ctx.tenantId,
        quoteNumber,
        clientId: input.clientId.trim(),
        status: "draft",
        issueDate,
        expiryDate: input.expiryDate === null ? null : normalizeDate(input.expiryDate ?? addDays(issueDate, defaultExpiryDays)),
        sentAt: null,
        viewedAt: null,
        acceptedAt: null,
        declinedAt: null,
        expiredAt: null,
        convertedAt: null,
        voidedAt: null,
        subtotalCents: totals.subtotalCents,
        taxBasisPoints,
        taxCents: totals.taxCents,
        discountCents,
        totalCents: totals.totalCents,
        currency: cleanCurrency(input.currency, defaultCurrency),
        notes: cleanText(input.notes),
        terms: cleanText(input.terms),
        convertedToInvoiceId: null,
        pdfKey: cleanText(input.pdfKey),
        createdById: cleanText(input.createdById ?? ctx.actorId),
        updatedById: null,
        createdAt,
        updatedAt: createdAt,
        lines: linesResult.data
      };
      await deps.store.insertQuote(quote);
      return ok(quote);
    },

    async updateEstimateQuote(ctx, input) {
      const currentResult = await requireQuote(ctx, input.quoteId);
      if (!currentResult.ok || !currentResult.data) return currentResult;
      const current = currentResult.data;
      if (current.status !== "draft") return fail("quote_not_editable", "Only draft estimate quotes can be edited.");
      const updatedAt = timestamp(ctx);
      const lines = input.lines
        ? buildLines(ctx, current.id, input.lines, createId)
        : ok(current.lines.map((line) => ({ ...line })));
      if (!lines.ok || !lines.data) return fail(lines.error?.code ?? "quote_lines_invalid", lines.error?.message ?? "Estimate quote lines are invalid.");
      const taxBasisPoints = input.taxBasisPoints === undefined ? current.taxBasisPoints : cleanBps(input.taxBasisPoints);
      const discountCents = input.discountCents === undefined ? current.discountCents : cleanCents(input.discountCents);
      const totals = calculateTotals(lines.data, taxBasisPoints, discountCents);
      if (!totals) return fail("discount_exceeds_subtotal", "Estimate quote discount cannot exceed subtotal.");
      const quote: EstimateQuote = {
        ...current,
        clientId: input.clientId?.trim() || current.clientId,
        issueDate: input.issueDate ? normalizeDate(input.issueDate) : current.issueDate,
        expiryDate: input.expiryDate === undefined ? current.expiryDate : input.expiryDate === null ? null : normalizeDate(input.expiryDate),
        taxBasisPoints,
        discountCents,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        currency: input.currency ? cleanCurrency(input.currency, current.currency) : current.currency,
        notes: input.notes === undefined ? current.notes : cleanText(input.notes),
        terms: input.terms === undefined ? current.terms : cleanText(input.terms),
        pdfKey: input.pdfKey === undefined ? current.pdfKey : cleanText(input.pdfKey),
        updatedById: cleanText(input.updatedById ?? ctx.actorId),
        updatedAt,
        lines: lines.data
      };
      await deps.store.updateQuote(quote);
      return ok(quote);
    },

    async getEstimateQuote(ctx, quoteId) {
      return requireQuote(ctx, quoteId);
    },

    async listEstimateQuotes(ctx, filter) {
      return ok(await deps.store.listQuotes(ctx.tenantId, filter));
    },

    async sendEstimateQuote(ctx, input) {
      const result = await requireQuote(ctx, input.quoteId);
      if (!result.ok || !result.data) return result;
      if (result.data.status !== "draft") return fail("quote_not_sendable", "Only draft estimate quotes can be sent.");
      const sentAt = timestamp(ctx, input.at);
      const quote: EstimateQuote = {
        ...result.data,
        status: "sent",
        sentAt,
        updatedById: cleanText(input.actorId ?? ctx.actorId),
        updatedAt: sentAt
      };
      await deps.store.updateQuote(quote);
      return ok(quote);
    },

    async markEstimateQuoteViewed(ctx, input) {
      const result = await requireQuote(ctx, input.quoteId);
      if (!result.ok || !result.data) return result;
      if (result.data.status === "viewed") return ok(result.data);
      if (result.data.status !== "sent") return fail("quote_not_viewable", "Only sent estimate quotes can be marked viewed.");
      const viewedAt = timestamp(ctx, input.at);
      const quote: EstimateQuote = {
        ...result.data,
        status: "viewed",
        viewedAt,
        updatedById: cleanText(input.actorId ?? ctx.actorId),
        updatedAt: viewedAt
      };
      await deps.store.updateQuote(quote);
      return ok(quote);
    },

    async acceptEstimateQuote(ctx, input) {
      const result = await requireQuote(ctx, input.quoteId);
      if (!result.ok || !result.data) return result;
      if (!isPending(result.data.status)) return fail("quote_not_acceptable", "Only sent or viewed estimate quotes can be accepted.");
      const acceptedAt = timestamp(ctx, input.at);
      if (isExpired(result.data, acceptedAt)) return fail("quote_expired", "Estimate quote has expired.");
      const quote: EstimateQuote = {
        ...result.data,
        status: "accepted",
        acceptedAt,
        updatedById: cleanText(input.actorId ?? ctx.actorId),
        updatedAt: acceptedAt
      };
      await deps.store.updateQuote(quote);
      return ok(quote);
    },

    async declineEstimateQuote(ctx, input) {
      const result = await requireQuote(ctx, input.quoteId);
      if (!result.ok || !result.data) return result;
      if (!isPending(result.data.status)) return fail("quote_not_declinable", "Only sent or viewed estimate quotes can be declined.");
      const declinedAt = timestamp(ctx, input.at);
      const quote: EstimateQuote = {
        ...result.data,
        status: "declined",
        declinedAt,
        notes: input.reason ? [result.data.notes, `Declined: ${input.reason.trim()}`].filter(Boolean).join("\n") : result.data.notes,
        updatedById: cleanText(input.actorId ?? ctx.actorId),
        updatedAt: declinedAt
      };
      await deps.store.updateQuote(quote);
      return ok(quote);
    },

    async voidEstimateQuote(ctx, input) {
      const result = await requireQuote(ctx, input.quoteId);
      if (!result.ok || !result.data) return result;
      if (result.data.status === "converted") return fail("quote_already_converted", "Converted estimate quotes cannot be voided.");
      if (result.data.status === "void") return ok(result.data);
      const voidedAt = timestamp(ctx, input.at);
      const quote: EstimateQuote = {
        ...result.data,
        status: "void",
        voidedAt,
        notes: input.reason ? [result.data.notes, `Voided: ${input.reason.trim()}`].filter(Boolean).join("\n") : result.data.notes,
        updatedById: cleanText(input.actorId ?? ctx.actorId),
        updatedAt: voidedAt
      };
      await deps.store.updateQuote(quote);
      return ok(quote);
    },

    async expireEstimateQuotes(ctx, input) {
      const asOf = normalizeDate(input.asOf);
      const due = await deps.store.listExpirableQuotes(ctx.tenantId, asOf, input.limit);
      const expiredAt = timestamp(ctx, asOf);
      const updates = due.map((quote) => ({
        ...quote,
        status: "expired" as const,
        expiredAt,
        updatedById: ctx.actorId ?? null,
        updatedAt: expiredAt
      }));
      for (const quote of updates) await deps.store.updateQuote(quote);
      return ok(updates);
    },

    async prepareInvoiceDraft(ctx, quoteId, invoiceId = null) {
      const result = await requireQuote(ctx, quoteId);
      if (!result.ok || !result.data) return fail(result.error?.code ?? "quote_not_found", result.error?.message ?? "Estimate quote was not found.");
      return ok(toInvoiceDraft(result.data, invoiceId, timestamp(ctx)));
    },

    async convertEstimateQuote(ctx, input) {
      const result = await requireQuote(ctx, input.quoteId);
      if (!result.ok || !result.data) return fail(result.error?.code ?? "quote_not_found", result.error?.message ?? "Estimate quote was not found.");
      if (!input.invoiceId.trim()) return fail("invoice_id_required", "Estimate quote conversion requires an invoice id.");
      if (result.data.status === "converted" && result.data.convertedToInvoiceId) {
        return ok({ quote: result.data, invoiceDraft: toInvoiceDraft(result.data, result.data.convertedToInvoiceId, timestamp(ctx, input.at)) });
      }
      if (result.data.status !== "accepted") return fail("quote_not_convertible", "Only accepted estimate quotes can be converted.");
      const convertedAt = timestamp(ctx, input.at);
      const quote: EstimateQuote = {
        ...result.data,
        status: "converted",
        convertedToInvoiceId: input.invoiceId.trim(),
        convertedAt,
        updatedById: cleanText(input.actorId ?? ctx.actorId),
        updatedAt: convertedAt
      };
      await deps.store.updateQuote(quote);
      return ok({ quote, invoiceDraft: toInvoiceDraft(quote, input.invoiceId.trim(), convertedAt) });
    },

    async getEstimateQuoteStats(ctx) {
      const { quotes } = await deps.store.listQuotes(ctx.tenantId, { limit: 100000 });
      const stats: EstimateQuoteStats = {
        draft: 0,
        sent: 0,
        accepted: 0,
        declined: 0,
        expired: 0,
        converted: 0,
        void: 0,
        totalValueCents: 0,
        pendingValueCents: 0,
        acceptedValueCents: 0,
        convertedValueCents: 0,
        conversionRateBasisPoints: 0
      };
      const asOf = timestamp(ctx);
      for (const quote of quotes) {
        stats.totalValueCents += quote.totalCents;
        const derivedStatus = isExpired(quote, asOf) ? "expired" : quote.status;
        const bucket = derivedStatus === "viewed" ? "sent" : derivedStatus;
        if (STATUS_KEYS.includes(bucket as (typeof STATUS_KEYS)[number])) stats[bucket as (typeof STATUS_KEYS)[number]] += 1;
        if (derivedStatus === "sent" || derivedStatus === "viewed") stats.pendingValueCents += quote.totalCents;
        if (derivedStatus === "accepted") stats.acceptedValueCents += quote.totalCents;
        if (derivedStatus === "converted") stats.convertedValueCents += quote.totalCents;
      }
      const denominator = stats.sent + stats.accepted + stats.converted;
      stats.conversionRateBasisPoints = denominator > 0 ? Math.round((stats.converted / denominator) * 10000) : 0;
      return ok(stats);
    }
  };
}

export function getEstimateQuoteModuleStatus() {
  return { id: "estimate-quote", status: "draft" } as const;
}
