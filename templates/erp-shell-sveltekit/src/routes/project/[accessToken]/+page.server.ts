import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createProjectProgressService, type TenantContext } from "@microservices-sh/project-progress";
import { requireModule } from "$lib/server/modules";
import { relativeTime } from "$lib/format";

function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip") ?? forwarded ?? "unknown";
}

function context(tenantId: string): TenantContext {
  return { tenantId, actorId: "public:project-progress" };
}

export const load: PageServerLoad = async ({ params, locals, platform, request }) => {
  requireModule("project-progress", platform);
  const accessToken = params.accessToken.trim();
  if (!accessToken) throw error(404, "Project not found");

  const ip = requestIp(request);
  const rate = await locals.rateLimitStore.hit(`project-progress:public:${ip}:${accessToken}`, 30, 300);
  if (!rate.allowed) throw error(429, "Too many requests. Try again later.");

  const company = await locals.rbacStore.firstOrganization();
  if (!company) throw error(404, "Project not found");

  const service = createProjectProgressService({ store: locals.projectProgressStore });
  const snapshot = await service.resolvePublicProject(context(company.id), accessToken);
  if (!snapshot.ok || !snapshot.data) throw error(404, "Project not found");

  const now = Date.now();
  return {
    company: { name: company.name },
    project: {
      title: snapshot.data.project.title,
      description: snapshot.data.project.description,
      location: snapshot.data.project.location,
      status: snapshot.data.project.status.replace("_", " "),
      startDate: snapshot.data.project.startDate,
      expectedEndDate: snapshot.data.project.expectedEndDate,
      actualEndDate: snapshot.data.project.actualEndDate,
      updated: relativeTime(snapshot.data.project.updatedAt, now)
    },
    timeline: snapshot.data.timeline.map((entry) => ({
      id: entry.log.id,
      category: entry.log.category,
      description: entry.log.description,
      captured: relativeTime(entry.log.capturedAt, now),
      media: entry.media.map((media) => ({
        id: media.id,
        fileType: media.fileType,
        mimeType: media.mimeType,
        fileSizeBytes: media.fileSizeBytes
      })),
      comments: entry.comments.map((comment) => ({
        id: comment.id,
        authorName: comment.authorName,
        authorType: comment.authorType,
        content: comment.content,
        created: relativeTime(comment.createdAt, now)
      }))
    })),
    comments: snapshot.data.comments.map((comment) => ({
      id: comment.id,
      authorName: comment.authorName,
      authorType: comment.authorType,
      content: comment.content,
      created: relativeTime(comment.createdAt, now)
    }))
  };
};
