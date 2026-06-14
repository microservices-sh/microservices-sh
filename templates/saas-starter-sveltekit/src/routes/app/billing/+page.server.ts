import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listPlans, listSubscriptions, startSubscription, changePlan, grantsAccess } from "@microservices-sh/billing-subscriptions";
import { recordEvent } from "@microservices-sh/audit-log";
import { authorize } from "@microservices-sh/org-team-rbac";

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { activeOrgId, permissions } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // The org id is the billing subscriber id — one subscription per org.
  const [plans, subs] = await Promise.all([
    listPlans({ store: locals.billingStore }),
    listSubscriptions({ subscriberId: activeOrgId, limit: 1 }, { store: locals.billingStore })
  ]);

  const subscription = subs.ok ? subs.data.subscriptions[0] ?? null : null;

  return {
    canManageBilling: permissions.includes("*") || permissions.includes("org.manage"),
    plans: plans.data.plans.map((plan) => ({ id: plan.id, name: plan.name, priceCents: plan.priceCents, currency: plan.currency, interval: plan.interval, features: plan.features })),
    subscription: subscription
      ? { id: subscription.id, planId: subscription.planId, status: subscription.status, hasAccess: grantsAccess(subscription.status), currentPeriodEnd: subscription.currentPeriodEnd }
      : null
  };
};

async function gateBilling(locals: App.Locals, orgId: string) {
  // Billing changes require org.manage (admins/owners), not plain membership.
  return authorize(orgId, locals.user!.id, "org.manage", { store: locals.rbacStore });
}

export const actions: Actions = {
  // Start a subscription when none exists, or switch plans when one does. The
  // billing module owns trial/period state and refuses changes on canceled subs.
  selectPlan: async ({ request, locals }) => {
    const form = await request.formData();
    const orgId = String(form.get("orgId") ?? "");
    const planId = String(form.get("planId") ?? "");
    const subscriptionId = String(form.get("subscriptionId") ?? "");
    if (!locals.user || !(await gateBilling(locals, orgId)).ok) {
      return fail(403, { error: "You do not have permission to manage billing." });
    }

    if (subscriptionId) {
      const result = await changePlan({ subscriptionId, newPlanId: planId }, { store: locals.billingStore });
      if (!result.ok) return fail(result.status, { error: result.error?.message ?? "Plan change failed." });
      await recordEvent(
        { eventName: "subscription.plan_changed", actorId: locals.user.id, entityType: "subscription", entityId: result.data.id, source: "billing", payload: { planId } },
        { auditStore: locals.auditStore }
      );
      return { ok: true, changed: true };
    }

    const result = await startSubscription({ subscriberId: orgId, planId, trialDays: 14 }, { store: locals.billingStore });
    if (!result.ok) return fail(result.status, { error: result.error?.message ?? "Could not start subscription." });
    await recordEvent(
      { eventName: "subscription.started", actorId: locals.user.id, entityType: "subscription", entityId: result.data.id, source: "billing", payload: { planId, status: result.data.status } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, started: true };
  }
};
