import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { createProjectProgressService, type ProjectStatus, type TenantContext } from "@microservices-sh/project-progress";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const STATUSES = new Set<ProjectStatus>(["planning", "in_progress", "completed", "on_hold"]);

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const next = text(value);
  return next.length > 0 ? next : null;
}

function statusValue(value: string): ProjectStatus {
  return STATUSES.has(value as ProjectStatus) ? (value as ProjectStatus) : "planning";
}

function context(tenantId: string, actorId: string): TenantContext {
  return { tenantId, actorId };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("project-progress", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
  const customers = await listCustomers({ customerRepository: locals.customerRepository });
  return {
    customers: customers.data.customers.map((customer) => ({ id: customer.id, name: customer.name }))
  };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies, platform }) => {
    requireModule("project-progress", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      customerId: text(form.get("customerId")),
      title: text(form.get("title")),
      description: optionalText(form.get("description")),
      location: optionalText(form.get("location")),
      status: statusValue(text(form.get("status"))),
      startDate: optionalText(form.get("startDate")),
      expectedEndDate: optionalText(form.get("expectedEndDate"))
    };

    const customers = await listCustomers({ customerRepository: locals.customerRepository });
    const customerExists = customers.data.customers.some((customer) => customer.id === values.customerId);
    if (!values.customerId || !customerExists || !values.title) {
      return fail(400, { error: "Choose a customer and enter a project title.", values });
    }

    const service = createProjectProgressService({ store: locals.projectProgressStore });
    const created = await service.createProject(context(org.id, locals.user.id), values);
    if (!created.ok || !created.data) {
      return fail(400, { error: created.error?.message ?? "Could not create project.", values });
    }

    await recordEvent(
      {
        eventName: "project-progress.project.created",
        actorId: locals.user.id,
        entityType: "project-progress",
        entityId: created.data.project.id,
        source: "app/project-progress/new",
        payload: { customerId: created.data.project.customerId, status: created.data.project.status }
      },
      { auditStore: locals.auditStore }
    );

    throw redirect(303, `/app/project-progress/${created.data.project.id}`);
  }
};
