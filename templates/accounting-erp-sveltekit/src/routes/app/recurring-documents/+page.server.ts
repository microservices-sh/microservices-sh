import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { listCustomers } from "@microservices-sh/customer";
import { listVendors } from "@microservices-sh/accounts-payable";
import {
  createRecurringDocumentsService,
  getRecurringDocumentsModuleStatus,
  type RecurringDocumentTemplate,
  type RecurringDocumentType,
  type RecurringFrequency,
  type RecurringTemplateStatus,
  type TenantContext
} from "@microservices-sh/recurring-documents";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const REPORT_DATE = "2026-06-21T00:00:00.000Z";
const REPORT_DAY = REPORT_DATE.slice(0, 10);
const DOCUMENT_TYPES = new Set<RecurringDocumentType>(["invoice", "bill"]);
const FREQUENCIES = new Set<RecurringFrequency>(["weekly", "monthly", "quarterly", "yearly", "custom"]);
const STATUSES = new Set<RecurringTemplateStatus>(["active", "paused", "completed", "cancelled"]);

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

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
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

function documentType(value: string): RecurringDocumentType | null {
  return DOCUMENT_TYPES.has(value as RecurringDocumentType) ? (value as RecurringDocumentType) : null;
}

function frequency(value: string): RecurringFrequency | null {
  return FREQUENCIES.has(value as RecurringFrequency) ? (value as RecurringFrequency) : null;
}

function statusFilter(value: string | null): RecurringTemplateStatus | undefined {
  return value && STATUSES.has(value as RecurringTemplateStatus) ? (value as RecurringTemplateStatus) : undefined;
}

function typeFilter(value: string | null): RecurringDocumentType | undefined {
  return value && DOCUMENT_TYPES.has(value as RecurringDocumentType) ? (value as RecurringDocumentType) : undefined;
}

function recurringContext(tenantId: string, actorId: string): TenantContext {
  return { tenantId, actorId, now: REPORT_DATE };
}

function recurringService(locals: App.Locals) {
  return createRecurringDocumentsService({
    store: locals.recurringDocumentsStore,
    config: { enabled: true, defaultCurrency: "USD", defaultPaymentTermsDays: 30 }
  });
}

function schedulePayload(template: RecurringDocumentTemplate) {
  return {
    name: template.name,
    documentType: template.documentType,
    partyId: template.partyId,
    status: template.status,
    frequency: template.frequency,
    nextRunDate: template.nextRunDate,
    totalCents: template.totalCents
  };
}

async function partyExists(locals: App.Locals, orgId: string, type: RecurringDocumentType, partyId: string) {
  if (type === "invoice") {
    const result = await listCustomers({ customerRepository: locals.customerRepository });
    return result.data.customers.some((customer) => customer.id === partyId);
  }
  const result = await listVendors(
    { tenantId: orgId, includeInactive: true, limit: 250 },
    { accountsPayableStore: locals.accountsPayableStore }
  );
  return result.ok && result.data.vendors.some((vendor) => vendor.id === partyId);
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("recurring-documents", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const service = recurringService(locals);
  const ctx = recurringContext(activeOrgId, locals.user.id);
  const activeType = typeFilter(url.searchParams.get("type"));
  const activeStatus = statusFilter(url.searchParams.get("status"));

  const [templatesResult, statsResult, customersResult, vendorsResult] = await Promise.all([
    service.listRecurringDocumentTemplates(ctx, {
      limit: 100,
      ...(activeType ? { documentType: activeType } : {}),
      ...(activeStatus ? { status: activeStatus } : {})
    }),
    service.getRecurringDocumentStats(ctx),
    listCustomers({ customerRepository: locals.customerRepository }),
    listVendors({ tenantId: activeOrgId, includeInactive: true, limit: 250 }, { accountsPayableStore: locals.accountsPayableStore })
  ]);

  const customers = customersResult.data.customers;
  const vendors = vendorsResult.ok ? vendorsResult.data.vendors : [];
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const vendorNameById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const templates = templatesResult.ok && templatesResult.data ? templatesResult.data.templates : [];
  const selectedTemplateId = text(url.searchParams.get("template")) || templates[0]?.id || null;
  const selectedResult = selectedTemplateId ? await service.getRecurringDocumentTemplate(ctx, selectedTemplateId) : null;
  const selectedTemplate = selectedResult?.ok && selectedResult.data ? selectedResult.data : null;

  function partyName(template: RecurringDocumentTemplate) {
    return template.documentType === "invoice"
      ? customerNameById.get(template.partyId) ?? template.partyId
      : vendorNameById.get(template.partyId) ?? template.partyId;
  }

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    today: REPORT_DAY,
    status: getRecurringDocumentsModuleStatus(),
    activeType: activeType ?? "all",
    activeStatus: activeStatus ?? "all",
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email })),
    vendors: vendors.map((vendor) => ({ id: vendor.id, name: vendor.name, email: vendor.email })),
    templates: templates.map((template) => ({ ...template, partyName: partyName(template) })),
    selectedTemplate: selectedTemplate ? { ...selectedTemplate, partyName: partyName(selectedTemplate) } : null,
    stats: statsResult.ok && statsResult.data
      ? statsResult.data
      : { active: 0, paused: 0, completed: 0, cancelled: 0, totalValueCents: 0, dueValueCents: 0 }
  };
};

export const actions: Actions = {
  createTemplate: async ({ request, locals, cookies, platform }) => {
    requireModule("recurring-documents", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      name: text(form.get("name")),
      documentType: documentType(text(form.get("documentType"))),
      customerId: text(form.get("customerId")),
      vendorId: text(form.get("vendorId")),
      frequency: frequency(text(form.get("frequency"))),
      customDays: text(form.get("customDays")),
      startDate: text(form.get("startDate")),
      endDate: text(form.get("endDate")),
      paymentTermsDays: text(form.get("paymentTermsDays")),
      maxOccurrences: text(form.get("maxOccurrences")),
      description: text(form.get("description")),
      quantity: text(form.get("quantity")),
      unitPrice: text(form.get("unitPrice")),
      taxRate: text(form.get("taxRate")),
      discount: text(form.get("discount")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      notes: text(form.get("notes")),
      terms: text(form.get("terms"))
    };
    const partyId = values.documentType === "bill" ? values.vendorId : values.customerId;
    const lineQuantity = quantity(values.quantity);
    const unitPriceCents = moneyToCents(values.unitPrice, Number.NaN);
    const taxBasisPoints = taxRateToBasisPoints(values.taxRate);
    const discountCents = moneyToCents(values.discount);
    const startDate = dateToIso(values.startDate);
    const endDate = values.endDate ? dateToIso(values.endDate) : null;
    const customDays = positiveInteger(values.customDays);
    const paymentTermsDays = positiveInteger(values.paymentTermsDays) ?? 30;
    const maxOccurrences = values.maxOccurrences ? positiveInteger(values.maxOccurrences) : null;
    if (!values.name || !values.documentType || !values.frequency || !partyId || !values.description || !startDate || (values.endDate && !endDate) || (values.frequency === "custom" && !customDays) || lineQuantity == null || unitPriceCents == null || Number.isNaN(unitPriceCents) || taxBasisPoints == null || discountCents == null) {
      return fail(400, { error: "Enter schedule, party, recurrence, start date, and valid line details.", values });
    }
    if (!(await partyExists(locals, org.id, values.documentType, partyId))) {
      return fail(400, { error: "Choose an existing customer or vendor for this schedule.", values });
    }

    const service = recurringService(locals);
    const result = await service.createRecurringDocumentTemplate(recurringContext(org.id, locals.user.id), {
      name: values.name,
      documentType: values.documentType,
      partyId,
      frequency: values.frequency,
      customDays,
      startDate,
      endDate,
      paymentTermsDays,
      maxOccurrences,
      taxBasisPoints,
      discountCents,
      currency: values.currency,
      notes: values.notes || null,
      terms: values.terms || null,
      autoSend: form.get("autoSend") === "on",
      autoApprove: form.get("autoApprove") === "on",
      createdById: locals.user.id,
      lines: [{ description: values.description, quantity: lineQuantity, unitPriceCents }]
    });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not create recurring document template.", values });

    await recordEvent(
      {
        eventName: "recurring-documents.created",
        actorId: locals.user.id,
        entityType: "recurring_document_template",
        entityId: result.data.id,
        source: "app/recurring-documents",
        payload: schedulePayload(result.data)
      },
      { auditStore: locals.auditStore }
    );

    return { templateCreated: true, templateId: result.data.id };
  },

  pauseTemplate: async ({ request, locals, cookies, platform }) => {
    requireModule("recurring-documents", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const templateId = text((await request.formData()).get("templateId"));
    const result = await recurringService(locals).pauseRecurringDocumentTemplate(recurringContext(org.id, locals.user.id), { templateId, actorId: locals.user.id, at: REPORT_DATE });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not pause schedule." });
    await recordEvent({ eventName: "recurring-documents.paused", actorId: locals.user.id, entityType: "recurring_document_template", entityId: result.data.id, source: "app/recurring-documents", payload: schedulePayload(result.data) }, { auditStore: locals.auditStore });
    return { paused: true, templateId: result.data.id };
  },

  resumeTemplate: async ({ request, locals, cookies, platform }) => {
    requireModule("recurring-documents", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const templateId = text((await request.formData()).get("templateId"));
    const result = await recurringService(locals).resumeRecurringDocumentTemplate(recurringContext(org.id, locals.user.id), { templateId, actorId: locals.user.id, at: REPORT_DATE });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not resume schedule." });
    await recordEvent({ eventName: "recurring-documents.resumed", actorId: locals.user.id, entityType: "recurring_document_template", entityId: result.data.id, source: "app/recurring-documents", payload: schedulePayload(result.data) }, { auditStore: locals.auditStore });
    return { resumed: true, templateId: result.data.id };
  },

  cancelTemplate: async ({ request, locals, cookies, platform }) => {
    requireModule("recurring-documents", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const templateId = text((await request.formData()).get("templateId"));
    const result = await recurringService(locals).cancelRecurringDocumentTemplate(recurringContext(org.id, locals.user.id), { templateId, actorId: locals.user.id, at: REPORT_DATE });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not cancel schedule." });
    await recordEvent({ eventName: "recurring-documents.cancelled", actorId: locals.user.id, entityType: "recurring_document_template", entityId: result.data.id, source: "app/recurring-documents", payload: schedulePayload(result.data) }, { auditStore: locals.auditStore });
    return { cancelled: true, templateId: result.data.id };
  },

  generateDue: async ({ request, locals, cookies, platform }) => {
    requireModule("recurring-documents", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const asOf = dateToIso(text(form.get("asOf"))) ?? REPORT_DATE;
    const limit = positiveInteger(text(form.get("limit"))) ?? 25;
    const result = await recurringService(locals).generateDueRecurringDocuments(recurringContext(org.id, locals.user.id), { asOf, limit });
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not generate due drafts." });

    await recordEvent(
      {
        eventName: "recurring-documents.generated",
        actorId: locals.user.id,
        entityType: "recurring_document_generation",
        entityId: org.id,
        source: "app/recurring-documents",
        payload: {
          asOf,
          generated: result.data.generated.length,
          completedTemplateIds: result.data.completedTemplateIds
        }
      },
      { auditStore: locals.auditStore }
    );

    return { generatedDue: true, generatedDrafts: result.data.generated, completedTemplateIds: result.data.completedTemplateIds };
  }
};
