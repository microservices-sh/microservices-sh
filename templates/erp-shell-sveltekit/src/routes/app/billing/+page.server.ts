import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import {
  listPlans,
  createPlan,
  listSubscriptions,
  startSubscription,
  cancelSubscription
} from "@microservices-sh/billing-subscriptions";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/billing-subscriptions: manage recurring
// plans and the company's customer subscriptions. Subscriptions are keyed by
// subscriberId (a customer id here) — resolved to a name for display.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("billing-subscriptions", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const [plansResult, subsResult, customersResult] = await Promise.all([
    listPlans({ store: locals.billingStore }),
    listSubscriptions({}, { store: locals.billingStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const plans = plansResult.ok ? plansResult.data.plans : [];
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const customerName = new Map(customersResult.data.customers.map((c) => [c.id, c.name]));
  const subs = subsResult.ok ? subsResult.data.subscriptions : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    customers: customersResult.data.customers.map((c) => ({ id: c.id, name: c.name })),
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
      interval: p.interval,
      status: p.status
    })),
    subscriptions: subs.map((s) => ({
      id: s.id,
      subscriber: customerName.get(s.subscriberId) ?? s.subscriberId,
      plan: planName.get(s.planId) ?? s.planId,
      status: s.status,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd
    }))
  };
};

async function gateManage(locals: App.Locals, cookies: import("@sveltejs/kit").Cookies, activeOrgId: string) {
  await requireOrgPermission(cookies, locals.user!.id, activeOrgId, "member.manage", locals.rbacStore);
}

export const actions: Actions = {
  createPlan: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await gateManage(locals, cookies, org.id);

    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const price = Number(form.get("price"));
    const interval = String(form.get("interval") ?? "month") === "year" ? "year" : "month";
    if (!name) return fail(400, { error: "Enter a plan name." });
    if (!Number.isFinite(price) || price < 0) return fail(400, { error: "Enter a valid price." });

    const result = await createPlan(
      { name, priceCents: Math.round(price * 100), currency: "USD", interval },
      { store: locals.billingStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not create the plan." });

    await recordEvent(
      { eventName: "billing.plan_created", actorId: locals.user.id, entityType: "plan", entityId: result.data.id, source: "app/billing", payload: { name } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, created: "plan" };
  },

  startSubscription: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await gateManage(locals, cookies, org.id);

    const form = await request.formData();
    const subscriberId = String(form.get("subscriberId") ?? "").trim();
    const planId = String(form.get("planId") ?? "").trim();
    if (!subscriberId || !planId) return fail(400, { error: "Choose a customer and a plan." });

    const result = await startSubscription({ subscriberId, planId }, { store: locals.billingStore });
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not start the subscription." });

    await recordEvent(
      { eventName: "subscription.started", actorId: locals.user.id, entityType: "subscription", entityId: result.data.id, source: "app/billing", payload: { subscriberId, planId } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, created: "subscription" };
  },

  cancel: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await gateManage(locals, cookies, org.id);

    const subscriptionId = String((await request.formData()).get("subscriptionId") ?? "").trim();
    if (!subscriptionId) return fail(400, { error: "Missing subscription." });

    const result = await cancelSubscription({ subscriptionId }, { store: locals.billingStore });
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not cancel the subscription." });

    await recordEvent(
      { eventName: "subscription.canceled", actorId: locals.user.id, entityType: "subscription", entityId: subscriptionId, source: "app/billing", payload: {} },
      { auditStore: locals.auditStore }
    );
    return { ok: true, canceled: true };
  }
};
