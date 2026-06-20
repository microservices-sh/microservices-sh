import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listPlans, startSubscription } from "@microservices-sh/billing-subscriptions";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Dedicated "Start a subscription" create page for @microservices-sh/billing-subscriptions.
// Loads the plan catalog and the customer book to populate the two dropdowns.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("billing-subscriptions", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  // Starting subscriptions requires member.manage; gate the page itself.
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

  const [plansResult, customersResult] = await Promise.all([
    listPlans({ store: locals.billingStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const plans = plansResult.ok ? plansResult.data.plans : [];
  return {
    customers: customersResult.data.customers.map((c) => ({ id: c.id, name: c.name })),
    plans: plans.map((p) => ({ id: p.id, name: p.name }))
  };
};

export const actions: Actions = {
  // Start the subscription and land back on the Billing list.
  default: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const subscriberId = String(form.get("subscriberId") ?? "").trim();
    const planId = String(form.get("planId") ?? "").trim();
    if (!subscriberId || !planId) return fail(400, { error: "Choose a customer and a plan." });

    const result = await startSubscription({ subscriberId, planId }, { store: locals.billingStore });
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not start the subscription." });

    await recordEvent(
      { eventName: "subscription.started", actorId: locals.user.id, entityType: "subscription", entityId: result.data.id, source: "app/billing/new", payload: { subscriberId, planId } },
      { auditStore: locals.auditStore }
    );

    throw redirect(303, "/app/billing");
  }
};
