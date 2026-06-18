import type { Actions, PageServerLoad } from "./$types";
import type { Cookies } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";
import {
  listOperatorTasks,
  updateOperatorTaskStatus,
  upsertOperatorTask,
  type OperatorTask,
  type OperatorTaskStatus
} from "@microservices-sh/operator-work";
import { recordEvent } from "@microservices-sh/audit-log";
import { readWorkspaceOrgId, requireOrgPermission } from "$lib/server/org-context";

const laneLabels: Record<OperatorTaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done"
};

function buildTaskLanes(tasks: OperatorTask[]) {
  return (Object.keys(laneLabels) as OperatorTaskStatus[]).map((status) => ({
    id: status,
    label: laneLabels[status],
    tasks: tasks.filter((task) => task.status === status)
  }));
}

async function requireWriteOrg(cookies: Cookies, locals: App.Locals) {
  if (!locals.user) return null;
  const orgId = readWorkspaceOrgId(cookies);
  if (!orgId) return null;
  await requireOrgPermission(cookies, locals.user.id, orgId, "member.manage", locals.rbacStore);
  return orgId;
}

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const result = await listOperatorTasks({ orgId: activeOrgId }, { store: locals.operatorWorkStore });
  const tasks = result.ok ? result.data.tasks : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    tasks,
    taskLanes: buildTaskLanes(tasks)
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const orgId = await requireWriteOrg(cookies, locals);
    if (!orgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const detail = String(form.get("detail") ?? "").trim();
    const category = String(form.get("category") ?? "").trim() || "Ops";
    const priority = String(form.get("priority") ?? "Medium");
    const dueLabel = String(form.get("dueLabel") ?? "").trim() || "Today";

    const result = await upsertOperatorTask(
      {
        orgId,
        title,
        detail,
        category,
        priority,
        dueLabel,
        source: "manual",
        actorId: locals.user.id,
        sourceLabel: "app/tasks:create"
      },
      { store: locals.operatorWorkStore }
    );

    if (!result.ok || !result.data) {
      return fail(result.status, { error: "Could not save the task.", values: { title, detail, category, dueLabel } });
    }

    await recordEvent(
      {
        eventName: "operator-work.task.upserted",
        actorId: locals.user.id,
        entityType: "operator_task",
        entityId: result.data.task.id,
        source: "app/tasks",
        payload: { orgId, title }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, created: true };
  },

  status: async ({ request, locals, cookies }) => {
    const orgId = await requireWriteOrg(cookies, locals);
    if (!orgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    const form = await request.formData();
    const taskId = String(form.get("taskId") ?? "").trim();
    const status = String(form.get("status") ?? "").trim();

    const result = await updateOperatorTaskStatus(
      {
        orgId,
        taskId,
        status,
        actorId: locals.user.id,
        sourceLabel: "app/tasks:status"
      },
      { store: locals.operatorWorkStore }
    );

    if (!result.ok || !result.data) {
      return fail(result.status, { error: "Could not update the task." });
    }

    await recordEvent(
      {
        eventName: "operator-work.task.status_changed",
        actorId: locals.user.id,
        entityType: "operator_task",
        entityId: result.data.task.id,
        source: "app/tasks",
        payload: { orgId, status: result.data.task.status }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, updated: true };
  }
};
