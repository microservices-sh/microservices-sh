import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { upsertCustomer } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("customer", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  // Creating customers requires member.manage; gate the page itself.
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
  return {};
};

export const actions: Actions = {
  // Create the customer and land on its detail page (Customer 360).
  default: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const phone = String(form.get("phone") ?? "").trim() || null;

    if (!name || !email.includes("@")) {
      return fail(400, { error: "Enter a name and a valid email.", values: { name, email, phone } });
    }

    const result = await upsertCustomer(
      { name, email, phone, notes: null },
      { customerRepository: locals.customerRepository }
    );
    if (!result.ok || !result.data) return fail(400, { error: "Could not save the customer." });

    await recordEvent(
      {
        eventName: "customer.created",
        actorId: locals.user.id,
        entityType: "customer",
        entityId: result.data.customer.id,
        source: "app/customers/new",
        payload: { email }
      },
      { auditStore: locals.auditStore }
    );

    throw redirect(303, `/app/customers/${result.data.customer.id}`);
  }
};
