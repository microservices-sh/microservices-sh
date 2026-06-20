import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listPlans, createPlan } from "@microservices-sh/billing-subscriptions";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Settings → Billing → Plans: the plan catalog (configuration) for the
// billing-subscriptions module. Operational subscription work lives in
// /app/billing; this surface is where plans are reviewed and created.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("billing-subscriptions", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const plansResult = await listPlans({ store: locals.billingStore });
  const plans = plansResult.ok ? plansResult.data.plans : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
      interval: p.interval,
      status: p.status
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
  }
};
