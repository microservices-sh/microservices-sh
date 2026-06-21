import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { authContext, createRecurringInvoiceTemplateScoped } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

interface LineRow {
  description: string;
  quantity: number;
  unitAmountCents: number;
  taxRateBps: number;
}

function parseLineItems(raw: string): LineRow[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is LineRow =>
          !!row &&
          typeof (row as LineRow).description === "string" &&
          (row as LineRow).description.trim().length > 0 &&
          Number.isFinite((row as LineRow).unitAmountCents)
      )
      .map((row) => ({
        description: row.description.trim().slice(0, 500),
        quantity: Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 1,
        unitAmountCents: Math.trunc(row.unitAmountCents),
        taxRateBps: Number.isFinite(row.taxRateBps) ? Math.min(100_000, Math.max(0, Math.trunc(row.taxRateBps))) : 0
      }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

function dateInputToIso(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function boundedInt(raw: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

function positiveIntOrNull(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("invoice", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
  const customersResult = await listCustomers({ customerRepository: locals.customerRepository });

  return {
    customers: customersResult.data.customers.map((customer) => ({ id: customer.id, name: customer.name }))
  };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies, platform }) => {
    requireModule("invoice", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: org.id, actorId: locals.user.id, roles: permissions });
    const form = await request.formData();

    const name = String(form.get("name") ?? "").trim();
    const customerId = String(form.get("customerId") ?? "").trim();
    const currency = (String(form.get("currency") ?? "USD").trim() || "USD").toUpperCase().slice(0, 3);
    const frequency = String(form.get("frequency") ?? "monthly").trim();
    const startAt = dateInputToIso(form.get("startAt"));
    const endAt = dateInputToIso(form.get("endAt"));
    const customDays = frequency === "custom" ? positiveIntOrNull(form.get("customDays")) : null;
    const maxOccurrences = positiveIntOrNull(form.get("maxOccurrences"));
    const paymentTermsDays = boundedInt(form.get("paymentTermsDays"), 14, 0, 365);
    const autoIssue = form.get("autoIssue") === "on";
    const notes = String(form.get("notes") ?? "").trim();
    const lineItems = parseLineItems(String(form.get("lineItems") ?? "[]"));

    if (!name) return fail(400, { error: "Name the recurring invoice." });
    if (!customerId) return fail(400, { error: "Choose a customer for the recurring invoice." });
    if (!startAt) return fail(400, { error: "Choose a valid start date." });
    if (frequency === "custom" && !customDays) return fail(400, { error: "Enter the custom interval in days." });
    if (lineItems.length === 0) return fail(400, { error: "Add at least one line item with a description and amount." });

    const created = await createRecurringInvoiceTemplateScoped(
      ctx,
      {
        name,
        customerId,
        currency,
        frequency,
        customDays,
        startAt,
        endAt,
        paymentTermsDays,
        maxOccurrences,
        autoIssue,
        notes: notes || null,
        lineItems
      },
      { recurringInvoiceStore: locals.recurringInvoiceStore }
    );
    if (!created.ok || !created.data) {
      return fail(created.status ?? 400, { error: created.error?.message ?? "Could not create the recurring invoice." });
    }

    await recordEvent(
      {
        eventName: "invoice.recurring_template_created",
        actorId: locals.user.id,
        entityType: "recurring_invoice_template",
        entityId: created.data.template.id,
        source: "app/invoices/recurring/new",
        payload: { customerId, frequency, totalCents: created.data.template.totalCents }
      },
      { auditStore: locals.auditStore }
    );

    throw redirect(303, `/app/invoices/recurring?created=${encodeURIComponent(created.data.template.name)}`);
  }
};
