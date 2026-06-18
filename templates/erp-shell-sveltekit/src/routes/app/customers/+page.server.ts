import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listCustomers, upsertCustomer } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("customer", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: any employee with org.read can view the customer book.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const result = await listCustomers({ customerRepository: locals.customerRepository });

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    customers: result.data.customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? null
    }))
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a company." });

    // Write gate: creating customers requires member.manage in the company org.
    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const phone = String(form.get("phone") ?? "").trim() || null;

    if (!name || !email.includes("@")) {
      return fail(400, { error: "Enter a name and a valid email.", values: { name, email, phone } });
    }

    const result = await upsertCustomer({ name, email, phone, notes: null }, { customerRepository: locals.customerRepository });
    if (!result.ok || !result.data) {
      return fail(400, { error: "Could not save the customer." });
    }

    await recordEvent(
      {
        eventName: "customer.created",
        actorId: locals.user.id,
        entityType: "customer",
        entityId: result.data.customer.id,
        source: "app/customers",
        payload: { email }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, created: true };
  }
};
