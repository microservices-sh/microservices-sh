import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import {
  listFocusBlocks,
  listOperatorTasks,
  upsertFocusBlock,
  type FocusEnergy,
  type OperatorTask
} from "@microservices-sh/operator-work";
import { recordEvent } from "@microservices-sh/audit-log";
import { readWorkspaceOrgId, requireOrgPermission } from "$lib/server/org-context";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function requireWriteOrg(cookies: import("@sveltejs/kit").Cookies, locals: App.Locals) {
  if (!locals.user) return null;
  const orgId = readWorkspaceOrgId(cookies);
  if (!orgId) return null;
  await requireOrgPermission(cookies, locals.user.id, orgId, "member.manage", locals.rbacStore);
  return orgId;
}

function draftPlan(orgId: string, tasks: OperatorTask[], actorId: string) {
  const first = tasks.find((task) => task.priority === "High") ?? tasks[0];
  const second = tasks.find((task) => task.id !== first?.id && task.status !== "done");
  const date = todayIso();

  return [
    {
      id: `focus_${orgId}_${date}_deep`,
      orgId,
      date,
      timeRange: "09:30-11:00",
      title: first?.title ?? "Primary build block",
      energy: "Deep" as FocusEnergy,
      note: "One outcome, no admin tabs."
    },
    {
      id: `focus_${orgId}_${date}_triage`,
      orgId,
      date,
      timeRange: "11:20-12:00",
      title: second?.title ?? "Agent output triage",
      energy: "Review" as FocusEnergy,
      note: "Approve, redirect, or park generated work."
    },
    {
      id: `focus_${orgId}_${date}_comms`,
      orgId,
      date,
      timeRange: "14:00-15:00",
      title: "Calendar and comms sweep",
      energy: "Comms" as FocusEnergy,
      note: "Clear external dependencies without breaking the deep-work lane."
    },
    {
      id: `focus_${orgId}_${date}_close`,
      orgId,
      date,
      timeRange: "16:30-17:00",
      title: "Daily unlock review",
      energy: "Close" as FocusEnergy,
      note: "Save the review before the work disappears."
    }
  ].map((block) => ({
    ...block,
    source: "ai-draft" as const,
    actorId,
    sourceLabel: "app/focus:draft"
  }));
}

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const date = todayIso();
  const [taskResult, blockResult] = await Promise.all([
    listOperatorTasks({ orgId: activeOrgId }, { store: locals.operatorWorkStore }),
    listFocusBlocks({ orgId: activeOrgId, date }, { store: locals.operatorWorkStore })
  ]);
  const tasks = taskResult.ok ? taskResult.data.tasks : [];
  const focusBlocks = blockResult.ok ? blockResult.data.blocks : [];

  return {
    date,
    openTasks: tasks.filter((task) => task.status !== "done"),
    focusBlocks
  };
};

export const actions: Actions = {
  createBlock: async ({ request, locals, cookies }) => {
    const orgId = await requireWriteOrg(cookies, locals);
    if (!orgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    const form = await request.formData();
    const result = await upsertFocusBlock(
      {
        orgId,
        date: String(form.get("date") ?? todayIso()),
        timeRange: String(form.get("timeRange") ?? "").trim(),
        title: String(form.get("title") ?? "").trim(),
        energy: String(form.get("energy") ?? "Deep"),
        note: String(form.get("note") ?? "").trim(),
        source: "manual",
        actorId: locals.user.id,
        sourceLabel: "app/focus:create"
      },
      { store: locals.operatorWorkStore }
    );

    if (!result.ok || !result.data) return fail(result.status, { error: "Could not save the focus block." });

    await recordEvent(
      {
        eventName: "operator-work.focus_block.upserted",
        actorId: locals.user.id,
        entityType: "operator_focus_block",
        entityId: result.data.block.id,
        source: "app/focus",
        payload: { orgId, date: result.data.block.date }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, created: true };
  },

  draft: async ({ locals, cookies }) => {
    const orgId = await requireWriteOrg(cookies, locals);
    if (!orgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    const taskResult = await listOperatorTasks({ orgId }, { store: locals.operatorWorkStore });
    const tasks = taskResult.ok ? taskResult.data.tasks.filter((task) => task.status !== "done") : [];
    const blocks = draftPlan(orgId, tasks, locals.user.id);

    for (const block of blocks) {
      const result = await upsertFocusBlock(block, { store: locals.operatorWorkStore });
      if (!result.ok) return fail(result.status, { error: "Could not draft the plan." });
    }

    await recordEvent(
      {
        eventName: "operator-work.focus_block.upserted",
        actorId: locals.user.id,
        entityType: "operator_focus_block",
        entityId: `${orgId}:${todayIso()}`,
        source: "app/focus",
        payload: { orgId, draftedBlocks: blocks.length }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, drafted: true };
  }
};
