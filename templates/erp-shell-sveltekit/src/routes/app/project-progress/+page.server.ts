import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listCustomers } from "@microservices-sh/customer";
import {
  createProjectProgressService,
  getProjectProgressModuleStatus,
  type ProjectStatus,
  type TenantContext
} from "@microservices-sh/project-progress";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { relativeTime, daysUntil } from "$lib/format";

const STATUSES = new Set<ProjectStatus>(["planning", "in_progress", "completed", "on_hold"]);

function statusFilter(value: string | null): ProjectStatus | undefined {
  return value && STATUSES.has(value as ProjectStatus) ? (value as ProjectStatus) : undefined;
}

function context(tenantId: string, actorId: string): TenantContext {
  return { tenantId, actorId };
}

function statusLabel(status: ProjectStatus): string {
  return status.replace("_", " ");
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("project-progress", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const service = createProjectProgressService({ store: locals.projectProgressStore });
  const tenantContext = context(activeOrgId, locals.user.id);
  const activeStatus = statusFilter(url.searchParams.get("status"));
  const activeCustomer = String(url.searchParams.get("customer") ?? "").trim();
  const now = Date.now();

  const [allProjectsResult, projectsResult, customersResult] = await Promise.all([
    service.listProjects(tenantContext, { limit: 100 }),
    service.listProjects(tenantContext, {
      limit: 100,
      ...(activeStatus ? { status: activeStatus } : {}),
      ...(activeCustomer ? { customerId: activeCustomer } : {})
    }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const customers = customersResult.data.customers;
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const allProjects = allProjectsResult.data ?? [];
  const projects = projectsResult.data ?? [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    status: getProjectProgressModuleStatus(),
    activeStatus: activeStatus ?? "all",
    activeCustomer,
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name })),
    metrics: {
      total: allProjects.length,
      active: allProjects.filter((project) => project.status === "in_progress").length,
      planning: allProjects.filter((project) => project.status === "planning").length,
      completed: allProjects.filter((project) => project.status === "completed").length
    },
    projects: projects.map((project) => {
      const dueDays = daysUntil(project.expectedEndDate, now);
      return {
        id: project.id,
        title: project.title,
        customerId: project.customerId,
        customerName: customerById.get(project.customerId)?.name ?? "Unknown customer",
        location: project.location,
        status: project.status,
        statusLabel: statusLabel(project.status),
        expectedEndDate: project.expectedEndDate,
        dueLabel:
          dueDays == null
            ? "No due date"
            : dueDays < 0
              ? `${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? "" : "s"} late`
              : dueDays === 0
                ? "Due today"
                : `Due in ${dueDays} day${dueDays === 1 ? "" : "s"}`,
        updated: relativeTime(project.updatedAt, now)
      };
    })
  };
};
