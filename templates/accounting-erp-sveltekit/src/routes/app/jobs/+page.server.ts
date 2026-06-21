import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { enqueueJob, listJobs, runDueJobs } from "@microservices-sh/jobs-workflows";
import { recordEvent } from "@microservices-sh/audit-log";
import { createRecurringInvoiceJobHandlers } from "$lib/server/recurring-invoice-jobs";
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

// Reference UI for @microservices-sh/jobs-workflows: inspect queued work and
// enqueue a diagnostic job. Recurring schedules are configured under
// /app/settings/schedules. Execution handlers still live in the host
// worker/cron layer.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("jobs-workflows", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const jobsResult = await listJobs({ limit: 100 }, { jobStore: locals.jobStore });

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    jobs: jobsResult.ok ? jobsResult.data.jobs : []
  };
};

export const actions: Actions = {
  runDue: async ({ locals, cookies, platform }) => {
    requireModule("jobs-workflows", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const result = await runDueJobs(
      createRecurringInvoiceJobHandlers({
        invoiceStore: locals.invoiceStore,
        recurringInvoiceStore: locals.recurringInvoiceStore,
        allocator: locals.numberAllocator,
        accountingCoreStore: locals.accountingCoreStore,
        accountsReceivableService: locals.accountsReceivableService,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }),
      { jobStore: locals.jobStore, runStore: locals.jobRunStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not run due jobs." });

    await recordEvent(
      {
        eventName: "jobs-workflows.due_jobs_run",
        actorId: locals.user.id,
        entityType: "job",
        entityId: "due",
        source: "app/jobs",
        payload: { ran: result.data.ran }
      },
      { auditStore: locals.auditStore }
    );
    return { ok: true, ranDue: true, ran: result.data.ran };
  },

  enqueue: async ({ request, locals, cookies, platform }) => {
    requireModule("jobs-workflows", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const type = String(form.get("type") ?? "").trim();
    const idempotencyKey = String(form.get("idempotencyKey") ?? "").trim() || undefined;
    if (!type) return fail(400, { error: "Enter a job type." });

    let payload: Record<string, unknown>;
    try {
      payload = parseObjectPayload(form.get("payload"));
    } catch (caught) {
      return fail(400, { error: caught instanceof Error ? caught.message : "Payload is invalid." });
    }

    const result = await enqueueJob(
      {
        type,
        payload,
        idempotencyKey,
        maxAttempts: positiveInt(form.get("maxAttempts"), 5),
        delayMs: Math.max(0, Number(form.get("delaySeconds") ?? 0) || 0) * 1000
      },
      { jobStore: locals.jobStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not enqueue the job." });

    await recordEvent(
      {
        eventName: "jobs-workflows.job_enqueued",
        actorId: locals.user.id,
        entityType: "job",
        entityId: String(result.data.id ?? "job"),
        source: "app/jobs",
        payload: { type, deduped: result.data.deduped }
      },
      { auditStore: locals.auditStore }
    );
    return { ok: true, enqueued: true };
  }
};
