import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { listPlans, listSubscriptions, cancelSubscription } from "@microservices-sh/billing-subscriptions";
import { getCustomer } from "@microservices-sh/customer";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { money, relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

const statusTone = (s: string): Tone =>
  s === "active" || s === "trialing" ? "good" : s === "past_due" || s === "unpaid" ? "warn" : "neutral";

const eventTone = (e: string): Tone =>
  e.includes("cancel") ? "bad" : e.includes("created") || e.includes("started") ? "info" : "neutral";

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("billing-subscriptions", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");
  const now = Date.now();

  // No single-subscription use case — resolve by id from the tenant's list.
  const [subsResult, plansResult, eventsResult] = await Promise.all([
    listSubscriptions({}, { store: locals.billingStore }),
    listPlans({ store: locals.billingStore }),
    listEvents({ entityType: "subscription", entityId: params.id, limit: 20 }, { auditStore: locals.auditStore })
  ]);
  const sub = subsResult.ok ? subsResult.data.subscriptions.find((s) => s.id === params.id) : undefined;
  if (!sub) throw error(404, "Subscription not found");

  const plan = plansResult.ok ? plansResult.data.plans.find((p) => p.id === sub.planId) : undefined;
  const cust = await getCustomer({ id: sub.subscriberId }, { customerRepository: locals.customerRepository });
  const customerName = cust.ok && cust.data ? cust.data.customer.name : sub.subscriberId;
  const events = eventsResult.ok ? eventsResult.data.events : [];

  return {
    canManage,
    subscription: {
      id: sub.id,
      status: sub.status,
      tone: statusTone(sub.status),
      isActive: sub.status !== "canceled",
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      subscriberId: sub.subscriberId,
      customerName,
      planName: plan?.name ?? sub.planId,
      planPrice: plan ? `${money(plan.priceCents, plan.currency)} / ${plan.interval}` : "—"
    },
    timeline: events.map((e) => ({
      title: humanizeEvent(e.eventName),
      time: relativeTime(e.createdAt, now),
      tone: eventTone(e.eventName)
    }))
  };
};

export const actions: Actions = {
  // Cancel this subscription (moved off the ledger). The module flips status to
  // canceled; we audit it scoped to this subscription entity.
  cancel: async ({ params, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const result = await cancelSubscription({ subscriptionId: params.id }, { store: locals.billingStore });
    if (!result.ok) {
      return fail(result.status ?? 400, { error: result.error?.message ?? "Could not cancel the subscription." });
    }

    await recordEvent(
      {
        eventName: "subscription.canceled",
        actorId: locals.user.id,
        entityType: "subscription",
        entityId: params.id,
        source: "app/billing/detail",
        payload: {}
      },
      { auditStore: locals.auditStore }
    );
    return { ok: true, canceled: true };
  }
};
