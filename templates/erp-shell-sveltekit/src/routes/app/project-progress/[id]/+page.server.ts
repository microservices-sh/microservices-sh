import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import {
  createProjectProgressService,
  type ProgressCategory,
  type ProjectStatus,
  type TenantContext
} from "@microservices-sh/project-progress";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { relativeTime } from "$lib/format";

const STATUSES = new Set<ProjectStatus>(["planning", "in_progress", "completed", "on_hold"]);
const CATEGORIES = new Set<ProgressCategory>(["painting", "plumbing", "masonry", "electrical", "carpentry", "general"]);

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const next = text(value);
  return next.length > 0 ? next : null;
}

function statusValue(value: string): ProjectStatus | null {
  return STATUSES.has(value as ProjectStatus) ? (value as ProjectStatus) : null;
}

function categoryValue(value: string): ProgressCategory {
  return CATEGORIES.has(value as ProgressCategory) ? (value as ProgressCategory) : "general";
}

function context(tenantId: string, actorId: string): TenantContext {
  return { tenantId, actorId };
}

function statusLabel(status: ProjectStatus): string {
  return status.replace("_", " ");
}

async function requireManage({
  locals,
  cookies,
  platform
}: {
  locals: App.Locals;
  cookies: import("@sveltejs/kit").Cookies;
  platform?: App.Platform;
}) {
  requireModule("project-progress", platform);
  if (!locals.user) return null;
  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  if (!org) return null;
  await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
  return { org, tenantContext: context(org.id, locals.user.id) };
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform, url }) => {
  requireModule("project-progress", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const service = createProjectProgressService({ store: locals.projectProgressStore });
  const snapshotResult = await service.getProjectSnapshot(context(activeOrgId, locals.user.id), params.id);
  if (!snapshotResult.ok || !snapshotResult.data) throw error(404, "Project not found");

  const now = Date.now();
  const customersResult = await listCustomers({ customerRepository: locals.customerRepository });
  const customer = customersResult.data.customers.find((candidate) => candidate.id === snapshotResult.data?.project.customerId);
  const snapshot = snapshotResult.data;

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    statusOptions: ["planning", "in_progress", "on_hold", "completed"].map((value) => ({
      value,
      label: statusLabel(value as ProjectStatus)
    })),
    categoryOptions: ["general", "painting", "plumbing", "masonry", "electrical", "carpentry"].map((value) => ({
      value,
      label: value
    })),
    project: {
      id: snapshot.project.id,
      title: snapshot.project.title,
      description: snapshot.project.description,
      location: snapshot.project.location,
      status: snapshot.project.status,
      statusLabel: statusLabel(snapshot.project.status),
      customerId: snapshot.project.customerId,
      customerName: customer?.name ?? "Unknown customer",
      accessToken: snapshot.project.accessToken,
      publicPath: `/project/${snapshot.project.accessToken}`,
      publicUrl: `${url.origin}/project/${snapshot.project.accessToken}`,
      startDate: snapshot.project.startDate,
      expectedEndDate: snapshot.project.expectedEndDate,
      actualEndDate: snapshot.project.actualEndDate,
      updated: relativeTime(snapshot.project.updatedAt, now),
      created: relativeTime(snapshot.project.createdAt, now)
    },
    access: snapshot.access.map((grant) => ({
      id: grant.id,
      userId: grant.userId,
      canUpload: grant.canUpload,
      canView: grant.canView,
      created: relativeTime(grant.createdAt, now)
    })),
    timeline: snapshot.timeline.map((entry) => ({
      log: {
        id: entry.log.id,
        category: entry.log.category,
        description: entry.log.description,
        uploaderId: entry.log.uploaderId,
        captured: relativeTime(entry.log.capturedAt, now),
        capturedAt: entry.log.capturedAt
      },
      media: entry.media.map((media) => ({
        id: media.id,
        fileType: media.fileType,
        mimeType: media.mimeType,
        fileSizeBytes: media.fileSizeBytes,
        dimensions: media.width && media.height ? `${media.width} x ${media.height}` : null
      })),
      comments: entry.comments.map((comment) => ({
        id: comment.id,
        authorType: comment.authorType,
        authorName: comment.authorName,
        content: comment.content,
        created: relativeTime(comment.createdAt, now)
      }))
    })),
    comments: snapshot.comments.map((comment) => ({
      id: comment.id,
      logId: comment.logId,
      authorType: comment.authorType,
      authorName: comment.authorName,
      content: comment.content,
      created: relativeTime(comment.createdAt, now)
    }))
  };
};

export const actions: Actions = {
  updateStatus: async ({ request, params, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const status = statusValue(text(form.get("status")));
    if (!status) return fail(400, { error: "Choose a valid project status." });

    const service = createProjectProgressService({ store: locals.projectProgressStore });
    const updated = await service.updateProjectStatus(scoped.tenantContext, {
      projectId: params.id,
      status,
      actualEndDate: optionalText(form.get("actualEndDate"))
    });
    if (!updated.ok || !updated.data) return fail(400, { error: updated.error?.message ?? "Could not update status." });

    await recordEvent(
      {
        eventName: "project-progress.project.status-changed",
        actorId: locals.user.id,
        entityType: "project-progress",
        entityId: updated.data.id,
        source: "app/project-progress/detail",
        payload: { status: updated.data.status }
      },
      { auditStore: locals.auditStore }
    );
    return { projectStatusUpdated: true };
  },

  addLog: async ({ request, params, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const description = optionalText(form.get("description"));
    if (!description) return fail(400, { error: "Enter a progress update." });

    const service = createProjectProgressService({ store: locals.projectProgressStore });
    const snapshot = await service.createProgressLog(scoped.tenantContext, {
      projectId: params.id,
      uploaderId: locals.user.id,
      category: categoryValue(text(form.get("category"))),
      description,
      capturedAt: optionalText(form.get("capturedAt"))
    });
    if (!snapshot.ok || !snapshot.data) return fail(400, { error: snapshot.error?.message ?? "Could not add progress update." });
    const log = snapshot.data.timeline[0]?.log;

    await recordEvent(
      {
        eventName: "project-progress.log.created",
        actorId: locals.user.id,
        entityType: "project-progress",
        entityId: params.id,
        source: "app/project-progress/detail",
        payload: { logId: log?.id ?? null }
      },
      { auditStore: locals.auditStore }
    );
    return { logAdded: true };
  },

  addComment: async ({ request, params, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const content = optionalText(form.get("content"));
    if (!content) return fail(400, { error: "Enter a comment." });

    const service = createProjectProgressService({ store: locals.projectProgressStore });
    const comment = await service.addProjectComment(scoped.tenantContext, {
      projectId: params.id,
      logId: optionalText(form.get("logId")),
      authorType: "admin",
      authorName: locals.user.email,
      authorId: locals.user.id,
      content
    });
    if (!comment.ok || !comment.data) return fail(400, { error: comment.error?.message ?? "Could not add comment." });

    await recordEvent(
      {
        eventName: "project-progress.comment.created",
        actorId: locals.user.id,
        entityType: "project-progress",
        entityId: params.id,
        source: "app/project-progress/detail",
        payload: { commentId: comment.data.id, logId: comment.data.logId }
      },
      { auditStore: locals.auditStore }
    );
    return { commentAdded: true };
  },

  grantAccess: async ({ request, params, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const userId = text(form.get("userId"));
    if (!userId) return fail(400, { error: "Enter a worker or member id." });

    const service = createProjectProgressService({ store: locals.projectProgressStore });
    const grant = await service.grantProjectAccess(scoped.tenantContext, {
      projectId: params.id,
      userId,
      canView: form.has("canView"),
      canUpload: form.has("canUpload")
    });
    if (!grant.ok || !grant.data) return fail(400, { error: grant.error?.message ?? "Could not grant access." });

    await recordEvent(
      {
        eventName: "project-progress.access.granted",
        actorId: locals.user.id,
        entityType: "project-progress",
        entityId: params.id,
        source: "app/project-progress/detail",
        payload: { userId: grant.data.userId, canView: grant.data.canView, canUpload: grant.data.canUpload }
      },
      { auditStore: locals.auditStore }
    );
    return { accessGranted: true };
  },

  revokeAccess: async ({ request, params, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const userId = text(form.get("userId"));
    if (!userId) return fail(400, { error: "Choose an access grant to revoke." });

    const service = createProjectProgressService({ store: locals.projectProgressStore });
    const revoked = await service.revokeProjectAccess(scoped.tenantContext, { projectId: params.id, userId });
    if (!revoked.ok) return fail(400, { error: revoked.error?.message ?? "Could not revoke access." });

    await recordEvent(
      {
        eventName: "project-progress.access.revoked",
        actorId: locals.user.id,
        entityType: "project-progress",
        entityId: params.id,
        source: "app/project-progress/detail",
        payload: { userId }
      },
      { auditStore: locals.auditStore }
    );
    return { accessRevoked: true };
  }
};
