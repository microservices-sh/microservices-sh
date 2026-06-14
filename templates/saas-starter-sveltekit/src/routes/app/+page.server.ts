import type { Actions, PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listMembers, authorize } from "@microservices-sh/org-team-rbac";
import { listSubscriptions, grantsAccess } from "@microservices-sh/billing-subscriptions";
import { setActiveOrg } from "$lib/server/org-context";

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) {
    return { onboarding: true as const };
  }

  // org-scoped read: every list is keyed by the active org id, gated by membership
  // in the /app layout. Subscriptions are filtered to this org as the subscriber.
  const [members, subs] = await Promise.all([
    listMembers(activeOrgId, { store: locals.rbacStore }),
    listSubscriptions({ subscriberId: activeOrgId, limit: 1 }, { store: locals.billingStore })
  ]);

  const subscription = subs.ok ? subs.data.subscriptions[0] ?? null : null;

  return {
    onboarding: false as const,
    memberCount: members.data.count,
    subscription: subscription
      ? { status: subscription.status, planId: subscription.planId, hasAccess: grantsAccess(subscription.status), currentPeriodEnd: subscription.currentPeriodEnd }
      : null
  };
};

export const actions: Actions = {
  // Switch the active org from the layout selector, but only to an org the user is
  // actually a member of (authorize returns 403 for non-members).
  switchOrg: async ({ request, cookies, locals }) => {
    if (!locals.user) throw redirect(303, "/login");
    const form = await request.formData();
    const orgId = String(form.get("orgId") ?? "");
    const decision = await authorize(orgId, locals.user.id, "org.read", { store: locals.rbacStore });
    if (decision.ok) setActiveOrg(cookies, orgId);
    throw redirect(303, "/app");
  }
};
