import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getRecurringBillTemplate, listVendors } from "@microservices-sh/accounts-payable";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone =>
  status === "active" ? "good" : status === "paused" ? "warn" : status === "cancelled" ? "bad" : "neutral";

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [templateResult, vendorsResult] = await Promise.all([
    getRecurringBillTemplate(
      { tenantId: activeOrgId, templateId: params.id },
      { accountsPayableStore: locals.accountsPayableStore }
    ),
    listVendors(
      { tenantId: activeOrgId, includeInactive: true, limit: 250 },
      { accountsPayableStore: locals.accountsPayableStore }
    )
  ]);
  if (!templateResult.ok || !templateResult.data) throw error(templateResult.status, templateResult.error.message);

  const template = templateResult.data.template;
  const vendor = vendorsResult.ok ? vendorsResult.data.vendors.find((item) => item.id === template.vendorId) : null;

  return {
    template: {
      ...template,
      vendorName: vendor?.name ?? template.vendorId,
      tone: statusTone(template.status),
      nextBillDateShort: shortDate(template.nextBillDate),
      lastBillDateShort: shortDate(template.lastBillDate),
      created: relativeTime(template.createdAt),
      updated: relativeTime(template.updatedAt),
      subtotal: money(template.subtotalCents, template.currency),
      tax: money(template.taxCents, template.currency),
      total: money(template.totalCents, template.currency)
    }
  };
};
