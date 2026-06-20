import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listPlans, listSubscriptions } from "@microservices-sh/billing-subscriptions";
import { listCustomers } from "@microservices-sh/customer";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/billing-subscriptions: the company's
// customer subscriptions. Read-only here — starting a subscription happens at
// /app/billing/new, and canceling happens on the subscription detail page.
// Plans are managed in the Settings hub (/app/settings/plans).
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("billing-subscriptions", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  // Plans + customers are loaded only to resolve names for the ledger rows.
  const [plansResult, subsResult, customersResult] = await Promise.all([
    listPlans({ store: locals.billingStore }),
    listSubscriptions({}, { store: locals.billingStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const planName = new Map((plansResult.ok ? plansResult.data.plans : []).map((p) => [p.id, p.name]));
  const customerName = new Map(customersResult.data.customers.map((c) => [c.id, c.name]));
  const subs = subsResult.ok ? subsResult.data.subscriptions : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    subscriptions: subs.map((s) => ({
      id: s.id,
      subscriber: customerName.get(s.subscriberId) ?? s.subscriberId,
      plan: planName.get(s.planId) ?? s.planId,
      status: s.status
    }))
  };
};
