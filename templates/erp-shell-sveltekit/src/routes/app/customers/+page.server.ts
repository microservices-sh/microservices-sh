import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listCustomers } from "@microservices-sh/customer";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("customer", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: any employee with org.read can view the customer book. The
  // directory is read-only here — creating happens at /app/customers/new.
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
