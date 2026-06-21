import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import {
  authContext,
  listRecurringInvoiceTemplatesScoped,
  updateRecurringInvoiceTemplateStatusScoped
} from "@microservices-sh/invoice";
import type { RecurringInvoiceStatus } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const actionableStatuses = new Set<RecurringInvoiceStatus>(["active", "paused", "cancelled"]);

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("invoice", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
  const [templatesResult, customersResult] = await Promise.all([
    listRecurringInvoiceTemplatesScoped(ctx, { limit: 100 }, { recurringInvoiceStore: locals.recurringInvoiceStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const nameById = new Map(customersResult.data.customers.map((customer) => [customer.id, customer.name]));
  const templates = templatesResult.ok ? templatesResult.data.templates : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    error: templatesResult.ok ? null : templatesResult.error?.message ?? "Could not load recurring invoices.",
    templates: templates.map((template) => ({
      id: template.id,
      name: template.name,
      customerId: template.customerId,
      customer: nameById.get(template.customerId) ?? template.customerId,
      status: template.status,
      frequency: template.frequency,
      customDays: template.customDays,
      nextInvoiceAt: template.nextInvoiceAt,
      lastInvoiceAt: template.lastInvoiceAt,
      invoicesGenerated: template.invoicesGenerated,
      maxOccurrences: template.maxOccurrences,
      autoIssue: template.autoIssue,
      currency: template.currency,
      totalCents: template.totalCents,
      lineCount: template.lineItems.length
    }))
  };
};

export const actions: Actions = {
  updateStatus: async ({ request, locals, cookies, platform }) => {
    requireModule("invoice", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: org.id, actorId: locals.user.id, roles: permissions });

    const form = await request.formData();
    const templateId = String(form.get("templateId") ?? "").trim();
    const status = String(form.get("status") ?? "").trim() as RecurringInvoiceStatus;
    if (!templateId) return fail(400, { error: "Choose a recurring invoice template." });
    if (!actionableStatuses.has(status)) return fail(400, { error: "Choose a valid recurring invoice status." });

    const result = await updateRecurringInvoiceTemplateStatusScoped(
      ctx,
      { templateId, status },
      { recurringInvoiceStore: locals.recurringInvoiceStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not update the recurring invoice." });

    await recordEvent(
      {
        eventName: "invoice.recurring_template_status_updated",
        actorId: locals.user.id,
        entityType: "recurring_invoice_template",
        entityId: templateId,
        source: "app/invoices/recurring",
        payload: { status }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, statusUpdated: true };
  }
};
