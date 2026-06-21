import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { listCustomers } from "@microservices-sh/customer";
import {
  createEstimateQuoteService,
  getEstimateQuoteModuleStatus,
  type EstimateQuote,
  type EstimateQuoteStatus,
  type TenantContext
} from "@microservices-sh/estimate-quote";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const REPORT_DATE = "2026-06-21T00:00:00.000Z";
const REPORT_DAY = REPORT_DATE.slice(0, 10);
const DEFAULT_EXPIRY_DAY = "2026-07-21";
const STATUSES = new Set<EstimateQuoteStatus>(["draft", "sent", "viewed", "accepted", "declined", "expired", "converted", "void"]);

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function moneyToCents(value: string, fallback = 0): number | null {
  if (!value) return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function quantity(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function taxRateToBasisPoints(value: string): number | null {
  if (!value) return 0;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? Math.round(rate * 100) : null;
}

function dateToIso(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function statusFilter(value: string | null): EstimateQuoteStatus | undefined {
  return value && STATUSES.has(value as EstimateQuoteStatus) ? (value as EstimateQuoteStatus) : undefined;
}

function quoteContext(tenantId: string, actorId: string): TenantContext {
  return { tenantId, actorId, now: REPORT_DATE };
}

function quotePayload(quote: EstimateQuote) {
  return {
    quoteNumber: quote.quoteNumber,
    clientId: quote.clientId,
    status: quote.status,
    totalCents: quote.totalCents
  };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("estimate-quote", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const service = createEstimateQuoteService({ store: locals.estimateQuoteStore });
  const ctx = quoteContext(activeOrgId, locals.user.id);
  const filter = statusFilter(url.searchParams.get("status"));

  const [quotesResult, statsResult, customersResult] = await Promise.all([
    service.listEstimateQuotes(ctx, { limit: 100, ...(filter ? { status: filter } : {}) }),
    service.getEstimateQuoteStats(ctx),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const customers = customersResult.data.customers;
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const quotes = quotesResult.ok && quotesResult.data ? quotesResult.data.quotes : [];
  const selectedQuoteId = text(url.searchParams.get("quote")) || quotes[0]?.id || null;
  const selectedResult = selectedQuoteId ? await service.getEstimateQuote(ctx, selectedQuoteId) : null;
  const selectedQuote = selectedResult?.ok && selectedResult.data ? selectedResult.data : null;
  const invoiceDraftResult = selectedQuote ? await service.prepareInvoiceDraft(ctx, selectedQuote.id) : null;

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    today: REPORT_DAY,
    defaultExpiryDate: DEFAULT_EXPIRY_DAY,
    status: getEstimateQuoteModuleStatus(),
    activeStatus: filter ?? "all",
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email
    })),
    quotes: quotes.map((quote) => ({
      ...quote,
      clientName: customerNameById.get(quote.clientId) ?? quote.clientId
    })),
    stats: statsResult.ok && statsResult.data
      ? statsResult.data
      : {
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
        },
    selectedQuote: selectedQuote
      ? {
          ...selectedQuote,
          clientName: customerNameById.get(selectedQuote.clientId) ?? selectedQuote.clientId
        }
      : null,
    invoiceDraft: invoiceDraftResult?.ok ? invoiceDraftResult.data : null
  };
};

export const actions: Actions = {
  createQuote: async ({ request, locals, cookies, platform }) => {
    requireModule("estimate-quote", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      customerId: text(form.get("customerId")),
      description: text(form.get("description")),
      quantity: text(form.get("quantity")),
      unitPrice: text(form.get("unitPrice")),
      taxRate: text(form.get("taxRate")),
      discount: text(form.get("discount")),
      expiryDate: text(form.get("expiryDate")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      notes: text(form.get("notes")),
      terms: text(form.get("terms"))
    };
    const lineQuantity = quantity(values.quantity);
    const unitPriceCents = moneyToCents(values.unitPrice, Number.NaN);
    const taxBasisPoints = taxRateToBasisPoints(values.taxRate);
    const discountCents = moneyToCents(values.discount);
    const expiryDate = values.expiryDate ? dateToIso(values.expiryDate) : undefined;
    if (!values.customerId || !values.description || lineQuantity == null || unitPriceCents == null || Number.isNaN(unitPriceCents) || taxBasisPoints == null || discountCents == null || (values.expiryDate && !expiryDate)) {
      return fail(400, { error: "Choose a customer, line description, quantity, price, tax rate, discount, and valid expiry date.", values });
    }

    const service = createEstimateQuoteService({ store: locals.estimateQuoteStore });
    const result = await service.createEstimateQuote(quoteContext(org.id, locals.user.id), {
      clientId: values.customerId,
      expiryDate,
      taxBasisPoints,
      discountCents,
      currency: values.currency,
      notes: values.notes || null,
      terms: values.terms || null,
      createdById: locals.user.id,
      lines: [
        {
          description: values.description,
          quantity: lineQuantity,
          unitPriceCents
        }
      ]
    });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not create quote.", values });

    await recordEvent(
      {
        eventName: "estimate-quote.created",
        actorId: locals.user.id,
        entityType: "estimate_quote",
        entityId: result.data.id,
        source: "app/quotes",
        payload: quotePayload(result.data)
      },
      { auditStore: locals.auditStore }
    );

    return { quoteCreated: true, quoteId: result.data.id, quoteNumber: result.data.quoteNumber };
  },

  sendQuote: async ({ request, locals, cookies, platform }) => {
    requireModule("estimate-quote", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const quoteId = text(form.get("quoteId"));
    if (!quoteId) return fail(400, { error: "Choose a quote to send." });

    const service = createEstimateQuoteService({ store: locals.estimateQuoteStore });
    const result = await service.sendEstimateQuote(quoteContext(org.id, locals.user.id), { quoteId, actorId: locals.user.id, at: REPORT_DATE });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not send quote." });

    await recordEvent(
      {
        eventName: "estimate-quote.sent",
        actorId: locals.user.id,
        entityType: "estimate_quote",
        entityId: result.data.id,
        source: "app/quotes",
        payload: quotePayload(result.data)
      },
      { auditStore: locals.auditStore }
    );

    return { quoteSent: true, quoteId: result.data.id };
  },

  acceptQuote: async ({ request, locals, cookies, platform }) => {
    requireModule("estimate-quote", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const quoteId = text(form.get("quoteId"));
    if (!quoteId) return fail(400, { error: "Choose a quote to accept." });

    const service = createEstimateQuoteService({ store: locals.estimateQuoteStore });
    const result = await service.acceptEstimateQuote(quoteContext(org.id, locals.user.id), { quoteId, actorId: locals.user.id, at: REPORT_DATE });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not accept quote." });

    await recordEvent(
      {
        eventName: "estimate-quote.accepted",
        actorId: locals.user.id,
        entityType: "estimate_quote",
        entityId: result.data.id,
        source: "app/quotes",
        payload: quotePayload(result.data)
      },
      { auditStore: locals.auditStore }
    );

    return { quoteAccepted: true, quoteId: result.data.id };
  },

  declineQuote: async ({ request, locals, cookies, platform }) => {
    requireModule("estimate-quote", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const quoteId = text(form.get("quoteId"));
    const reason = text(form.get("reason")) || "Declined from quote console";
    if (!quoteId) return fail(400, { error: "Choose a quote to decline." });

    const service = createEstimateQuoteService({ store: locals.estimateQuoteStore });
    const result = await service.declineEstimateQuote(quoteContext(org.id, locals.user.id), {
      quoteId,
      actorId: locals.user.id,
      at: REPORT_DATE,
      reason
    });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not decline quote." });

    await recordEvent(
      {
        eventName: "estimate-quote.declined",
        actorId: locals.user.id,
        entityType: "estimate_quote",
        entityId: result.data.id,
        source: "app/quotes",
        payload: quotePayload(result.data)
      },
      { auditStore: locals.auditStore }
    );

    return { quoteDeclined: true, quoteId: result.data.id };
  },

  voidQuote: async ({ request, locals, cookies, platform }) => {
    requireModule("estimate-quote", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const quoteId = text(form.get("quoteId"));
    const reason = text(form.get("reason")) || "Voided from quote console";
    if (!quoteId) return fail(400, { error: "Choose a quote to void." });

    const service = createEstimateQuoteService({ store: locals.estimateQuoteStore });
    const result = await service.voidEstimateQuote(quoteContext(org.id, locals.user.id), {
      quoteId,
      actorId: locals.user.id,
      at: REPORT_DATE,
      reason
    });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not void quote." });

    await recordEvent(
      {
        eventName: "estimate-quote.voided",
        actorId: locals.user.id,
        entityType: "estimate_quote",
        entityId: result.data.id,
        source: "app/quotes",
        payload: quotePayload(result.data)
      },
      { auditStore: locals.auditStore }
    );

    return { quoteVoided: true, quoteId: result.data.id };
  }
};
