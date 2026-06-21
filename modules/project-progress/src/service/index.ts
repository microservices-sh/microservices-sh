import type { ProjectProgressStore } from "../ports";
import type {
  AddProjectCommentInput,
  AttachProgressMediaInput,
  CreateProgressLogInput,
  CreateProjectInput,
  GrantProjectAccessInput,
  ListProjectsInput,
  ModuleResult,
  ProgressCategory,
  ProgressLog,
  ProgressMediaFile,
  ProjectAccessGrant,
  ProjectComment,
  ProjectCommentAuthorType,
  ProjectProgressIdFactory,
  ProjectProgressIdPrefix,
  ProjectProgressProject,
  ProjectProgressSnapshot,
  ProjectProgressTokenFactory,
  ProjectStatus,
  RevokeProjectAccessInput,
  TenantContext,
  UpdateProjectStatusInput
} from "../types";

const PROJECT_STATUSES = new Set<ProjectStatus>(["planning", "in_progress", "completed", "on_hold"]);
const PROGRESS_CATEGORIES = new Set<ProgressCategory>(["painting", "plumbing", "masonry", "electrical", "carpentry", "general"]);
const PROGRESS_MEDIA_TYPES = new Set(["image", "video"]);
const COMMENT_AUTHOR_TYPES = new Set<ProjectCommentAuthorType>(["customer", "worker", "admin"]);

export interface ProjectProgressServiceDeps {
  store: ProjectProgressStore;
  createId?: ProjectProgressIdFactory;
  createAccessToken?: ProjectProgressTokenFactory;
}

export interface ProjectProgressService {
  createProject(ctx: TenantContext, input: CreateProjectInput): Promise<ModuleResult<ProjectProgressSnapshot>>;
  updateProjectStatus(ctx: TenantContext, input: UpdateProjectStatusInput): Promise<ModuleResult<ProjectProgressProject>>;
  grantProjectAccess(ctx: TenantContext, input: GrantProjectAccessInput): Promise<ModuleResult<ProjectAccessGrant>>;
  revokeProjectAccess(ctx: TenantContext, input: RevokeProjectAccessInput): Promise<ModuleResult<{ revoked: true }>>;
  createProgressLog(ctx: TenantContext, input: CreateProgressLogInput): Promise<ModuleResult<ProjectProgressSnapshot>>;
  attachProgressMedia(ctx: TenantContext, input: AttachProgressMediaInput): Promise<ModuleResult<ProgressMediaFile>>;
  addProjectComment(ctx: TenantContext, input: AddProjectCommentInput): Promise<ModuleResult<ProjectComment>>;
  getProjectSnapshot(ctx: TenantContext, projectId: string): Promise<ModuleResult<ProjectProgressSnapshot>>;
  resolvePublicProject(ctx: TenantContext, accessToken: string): Promise<ModuleResult<ProjectProgressSnapshot>>;
  listProjects(ctx: TenantContext, input?: ListProjectsInput): Promise<ModuleResult<ProjectProgressProject[]>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialProjectProgressIdFactory(): ProjectProgressIdFactory {
  let sequence = 0;
  return (prefix: ProjectProgressIdPrefix) => id(prefix, ++sequence);
}

export function createSequentialProjectProgressTokenFactory(): ProjectProgressTokenFactory {
  let sequence = 0;
  return () => `ptok_${(++sequence).toString(36).padStart(10, "0")}`;
}

function defaultId(prefix: ProjectProgressIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function defaultToken(): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function resolveActualEndDate(input: UpdateProjectStatusInput, project: ProjectProgressProject, timestamp: string): string | null {
  if (input.status !== "completed") return project.actualEndDate;
  return cleanText(input.actualEndDate) ?? timestamp;
}

async function buildSnapshot(store: ProjectProgressStore, tenantId: string, project: ProjectProgressProject): Promise<ProjectProgressSnapshot> {
  const access = await store.listProjectAccess(tenantId, project.id);
  const logs = await store.listProgressLogsByProject(tenantId, project.id);
  const timeline = [];
  for (const log of logs) {
    timeline.push({
      log,
      media: await store.listMediaFilesByLog(tenantId, log.id),
      comments: await store.listCommentsByLog(tenantId, log.id)
    });
  }
  return {
    project,
    access,
    timeline,
    comments: await store.listCommentsByProject(tenantId, project.id)
  };
}

export function createProjectProgressService(deps: ProjectProgressServiceDeps): ProjectProgressService {
  const createId = deps.createId ?? defaultId;
  const createAccessToken = deps.createAccessToken ?? defaultToken;

  return {
    async createProject(ctx, input) {
      const customerId = cleanText(input.customerId);
      const title = cleanText(input.title);
      if (!customerId) return fail("customer_required", "Customer id is required.");
      if (!title) return fail("title_required", "Project title is required.");
      const status = input.status ?? "planning";
      if (!PROJECT_STATUSES.has(status)) return fail("status_invalid", "Project status is not supported.");

      const timestamp = now(ctx);
      const project: ProjectProgressProject = {
        id: createId("pproj"),
        tenantId: ctx.tenantId,
        customerId,
        title,
        description: cleanText(input.description),
        location: cleanText(input.location),
        status,
        accessToken: createAccessToken(),
        qrCodeKey: cleanText(input.qrCodeKey),
        startDate: cleanText(input.startDate),
        expectedEndDate: cleanText(input.expectedEndDate),
        actualEndDate: null,
        createdById: cleanText(ctx.actorId),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertProject(project);
      return ok(await buildSnapshot(deps.store, ctx.tenantId, project));
    },

    async updateProjectStatus(ctx, input) {
      const project = await deps.store.getProject(ctx.tenantId, input.projectId);
      if (!project) return fail("project_not_found", "Project was not found.");
      if (!PROJECT_STATUSES.has(input.status)) return fail("status_invalid", "Project status is not supported.");
      const timestamp = now(ctx);
      const updated: ProjectProgressProject = {
        ...project,
        status: input.status,
        actualEndDate: resolveActualEndDate(input, project, timestamp),
        updatedAt: timestamp
      };
      await deps.store.upsertProject(updated);
      return ok(updated);
    },

    async grantProjectAccess(ctx, input) {
      const project = await deps.store.getProject(ctx.tenantId, input.projectId);
      if (!project) return fail("project_not_found", "Project was not found.");
      const userId = cleanText(input.userId);
      if (!userId) return fail("user_required", "User id is required.");
      const existing = await deps.store.getProjectAccess(ctx.tenantId, project.id, userId);
      const grant: ProjectAccessGrant = {
        id: existing?.id ?? createId("pacc"),
        tenantId: ctx.tenantId,
        projectId: project.id,
        userId,
        canUpload: input.canUpload ?? existing?.canUpload ?? true,
        canView: input.canView ?? existing?.canView ?? true,
        createdById: existing?.createdById ?? cleanText(ctx.actorId),
        createdAt: existing?.createdAt ?? now(ctx)
      };
      await deps.store.upsertProjectAccess(grant);
      return ok(grant);
    },

    async revokeProjectAccess(ctx, input) {
      await deps.store.deleteProjectAccess(ctx.tenantId, input.projectId, input.userId);
      return ok({ revoked: true as const });
    },

    async createProgressLog(ctx, input) {
      const project = await deps.store.getProject(ctx.tenantId, input.projectId);
      if (!project) return fail("project_not_found", "Project was not found.");
      const uploaderId = cleanText(input.uploaderId) ?? cleanText(ctx.actorId);
      if (!uploaderId) return fail("uploader_required", "Uploader id is required.");
      const category = input.category ?? "general";
      if (!PROGRESS_CATEGORIES.has(category)) return fail("category_invalid", "Progress category is not supported.");
      const timestamp = now(ctx);
      const log: ProgressLog = {
        id: createId("plog"),
        tenantId: ctx.tenantId,
        projectId: project.id,
        uploaderId,
        category,
        description: cleanText(input.description),
        voiceNoteKey: cleanText(input.voiceNoteKey),
        capturedAt: cleanText(input.capturedAt) ?? timestamp,
        createdAt: timestamp
      };
      await deps.store.insertProgressLog(log);
      return ok(await buildSnapshot(deps.store, ctx.tenantId, project));
    },

    async attachProgressMedia(ctx, input) {
      const log = await deps.store.getProgressLog(ctx.tenantId, input.logId);
      if (!log) return fail("log_not_found", "Progress log was not found.");
      const storageKey = cleanText(input.storageKey);
      const mimeType = cleanText(input.mimeType);
      if (!storageKey || storageKey.includes("..")) return fail("storage_key_invalid", "Storage key is required and cannot contain parent traversal.");
      if (!mimeType) return fail("mime_type_required", "MIME type is required.");
      if (!PROGRESS_MEDIA_TYPES.has(input.fileType)) return fail("file_type_invalid", "Progress media type is not supported.");
      if (!isNonNegativeInteger(input.fileSizeBytes)) return fail("file_size_invalid", "File size must be a non-negative integer.");
      if (input.durationSeconds != null && !isNonNegativeInteger(input.durationSeconds)) return fail("duration_invalid", "Duration must be a non-negative integer.");
      if (input.width != null && !isNonNegativeInteger(input.width)) return fail("width_invalid", "Width must be a non-negative integer.");
      if (input.height != null && !isNonNegativeInteger(input.height)) return fail("height_invalid", "Height must be a non-negative integer.");
      const media: ProgressMediaFile = {
        id: createId("pmed"),
        tenantId: ctx.tenantId,
        logId: log.id,
        storageKey,
        thumbnailKey: cleanText(input.thumbnailKey),
        fileType: input.fileType,
        mimeType,
        fileSizeBytes: input.fileSizeBytes,
        durationSeconds: input.durationSeconds ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        createdAt: now(ctx)
      };
      await deps.store.insertMediaFile(media);
      return ok(media);
    },

    async addProjectComment(ctx, input) {
      const project = await deps.store.getProject(ctx.tenantId, input.projectId);
      if (!project) return fail("project_not_found", "Project was not found.");
      if (input.logId && !(await deps.store.getProgressLog(ctx.tenantId, input.logId))) return fail("log_not_found", "Progress log was not found.");
      const authorName = cleanText(input.authorName);
      const content = cleanText(input.content);
      if (!COMMENT_AUTHOR_TYPES.has(input.authorType)) return fail("author_type_invalid", "Comment author type is not supported.");
      if (!authorName) return fail("author_required", "Author name is required.");
      if (!content) return fail("content_required", "Comment content is required.");
      const comment: ProjectComment = {
        id: createId("pcmt"),
        tenantId: ctx.tenantId,
        projectId: project.id,
        logId: cleanText(input.logId),
        authorType: input.authorType,
        authorName,
        authorId: cleanText(input.authorId),
        content,
        createdAt: now(ctx)
      };
      await deps.store.insertComment(comment);
      return ok(comment);
    },

    async getProjectSnapshot(ctx, projectId) {
      const project = await deps.store.getProject(ctx.tenantId, projectId);
      if (!project) return fail("project_not_found", "Project was not found.");
      return ok(await buildSnapshot(deps.store, ctx.tenantId, project));
    },

    async resolvePublicProject(ctx, accessToken) {
      const token = cleanText(accessToken);
      if (!token) return fail("access_token_required", "Access token is required.");
      const project = await deps.store.getProjectByAccessToken(ctx.tenantId, token);
      if (!project) return fail("project_not_found", "Project was not found.");
      return ok(await buildSnapshot(deps.store, ctx.tenantId, project));
    },

    async listProjects(ctx, input = {}) {
      return ok(await deps.store.listProjects(ctx.tenantId, input));
    }
  };
}

export function getProjectProgressModuleStatus() {
  return { id: "project-progress", status: "draft" } as const;
}
