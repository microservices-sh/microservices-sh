import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listDailyReviews, listOperatorTasks, saveDailyReview } from "@microservices-sh/operator-work";
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

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const [reviewResult, taskResult] = await Promise.all([
    listDailyReviews({ orgId: activeOrgId, limit: 5 }, { store: locals.operatorWorkStore }),
    listOperatorTasks({ orgId: activeOrgId, status: "done" }, { store: locals.operatorWorkStore })
  ]);

  const reviews = reviewResult.ok ? reviewResult.data.reviews : [];
  const completedTasks = taskResult.ok ? taskResult.data.tasks : [];

  return {
    date: todayIso(),
    reviews,
    latestReview: reviews[0] ?? null,
    completedTasks,
    reviewSignals: [
      { label: "Saved reviews", value: String(reviews.filter((review) => review.status === "saved").length), tone: "good" as const },
      { label: "Open blockers", value: reviews[0]?.openLoops ? "1+" : "0", tone: reviews[0]?.openLoops ? "warn" as const : "good" as const },
      { label: "Agent handoffs", value: reviews[0]?.agentHandoffs ? "1+" : "0", tone: "info" as const }
    ]
  };
};

export const actions: Actions = {
  save: async ({ request, locals, cookies }) => {
    const orgId = await requireWriteOrg(cookies, locals);
    if (!orgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    const form = await request.formData();
    const result = await saveDailyReview(
      {
        orgId,
        date: String(form.get("date") ?? todayIso()),
        shipped: String(form.get("shipped") ?? "").trim(),
        openLoops: String(form.get("openLoops") ?? "").trim(),
        agentHandoffs: String(form.get("agentHandoffs") ?? "").trim(),
        tomorrowFirstMove: String(form.get("tomorrowFirstMove") ?? "").trim(),
        actorId: locals.user.id,
        sourceLabel: "app/review:save"
      },
      { store: locals.operatorWorkStore }
    );

    if (!result.ok || !result.data) return fail(result.status, { error: "Could not save the daily review." });

    await recordEvent(
      {
        eventName: "operator-work.daily_review.saved",
        actorId: locals.user.id,
        entityType: "operator_daily_review",
        entityId: result.data.review.id,
        source: "app/review",
        payload: { orgId, date: result.data.review.date }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, saved: true };
  }
};
