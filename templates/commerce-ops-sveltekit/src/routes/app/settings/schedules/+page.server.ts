import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dueScheduledJobs, listSchedules, upsertSchedule } from "@microservices-sh/jobs-workflows";
import { recordEvent } from "@microservices-sh/audit-log";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function parseObjectPayload(raw: FormDataEntryValue | null): Record<string, unknown> {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function positiveInt(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function firstRunAt(value: FormDataEntryValue | null): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("First run time is invalid.");
  return date.toISOString();
}

// Configuration surface for @microservices-sh/jobs-workflows recurring schedules:
// define recurring schedules and trigger schedule catch-up. The operational
// queue lives under /app/jobs; execution handlers still live in the host
// worker/cron layer.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("jobs-workflows", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const schedulesResult = await listSchedules({ scheduleStore: locals.scheduleStore });

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    schedules: schedulesResult.ok ? schedulesResult.data.schedules : []
  };
};

export const actions: Actions = {
  schedule: async ({ request, locals, cookies, platform }) => {
    requireModule("jobs-workflows", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const type = String(form.get("type") ?? "").trim();
    if (!type) return fail(400, { error: "Enter a schedule job type." });

    let payload: Record<string, unknown>;
    let firstRun: string | undefined;
    try {
      payload = parseObjectPayload(form.get("payload"));
      firstRun = firstRunAt(form.get("firstRunAt"));
    } catch (caught) {
      return fail(400, { error: caught instanceof Error ? caught.message : "Schedule input is invalid." });
    }

    const intervalMinutes = positiveInt(form.get("intervalMinutes"), 60);
    const result = await upsertSchedule(
      {
        type,
        payload,
        intervalMs: intervalMinutes * 60_000,
        maxAttempts: positiveInt(form.get("maxAttempts"), 5),
        firstRunAt: firstRun
      },
      { scheduleStore: locals.scheduleStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not save the schedule." });

    await recordEvent(
      {
        eventName: "jobs-workflows.schedule_saved",
        actorId: locals.user.id,
        entityType: "job_schedule",
        entityId: result.data.id,
        source: "app/jobs",
        payload: { type, intervalMinutes }
      },
      { auditStore: locals.auditStore }
    );
    return { ok: true, scheduled: true };
  },

  catchUp: async ({ locals, cookies, platform }) => {
    requireModule("jobs-workflows", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const result = await dueScheduledJobs({ scheduleStore: locals.scheduleStore, jobStore: locals.jobStore });
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not run schedule catch-up." });

    await recordEvent(
      {
        eventName: "jobs-workflows.schedule_catchup",
        actorId: locals.user.id,
        entityType: "job_schedule",
        entityId: "catch-up",
        source: "app/jobs",
        payload: { enqueued: result.data.enqueued }
      },
      { auditStore: locals.auditStore }
    );
    return { ok: true, catchUp: true, enqueuedCount: result.data.enqueued };
  }
};
