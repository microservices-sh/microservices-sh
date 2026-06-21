import type { ProjectProgressStore } from "../ports";
import type {
  ListProjectsInput,
  ProgressLog,
  ProgressMediaFile,
  ProjectAccessGrant,
  ProjectComment,
  ProjectProgressProject
} from "../types";

export interface ProjectProgressMemoryStoreState {
  projects?: ProjectProgressProject[];
  access?: ProjectAccessGrant[];
  logs?: ProgressLog[];
  media?: ProgressMediaFile[];
  comments?: ProjectComment[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function accessKey(tenantId: string, projectId: string, userId: string): string {
  return `${tenantId}:${projectId}:${userId}`;
}

function recordKey(tenantId: string, id: string): string {
  return `${tenantId}:${id}`;
}

function tokenKey(tenantId: string, accessToken: string): string {
  return `${tenantId}:${accessToken}`;
}

function matches(project: ProjectProgressProject, input: ListProjectsInput = {}, access: Map<string, ProjectAccessGrant>): boolean {
  if (input.customerId && project.customerId !== input.customerId) return false;
  if (input.status && project.status !== input.status) return false;
  if (input.userId) {
    const grant = access.get(accessKey(project.tenantId, project.id, input.userId));
    if (!grant?.canView) return false;
  }
  return true;
}

export function createProjectProgressMemoryStore(initialState: ProjectProgressMemoryStoreState = {}): ProjectProgressStore {
  const projects = new Map<string, ProjectProgressProject>();
  const tokens = new Map<string, string>();
  const access = new Map<string, ProjectAccessGrant>();
  const logs = new Map<string, ProgressLog>();
  const media = new Map<string, ProgressMediaFile>();
  const comments = new Map<string, ProjectComment>();

  for (const project of initialState.projects ?? []) {
    const key = recordKey(project.tenantId, project.id);
    projects.set(key, copy(project));
    tokens.set(tokenKey(project.tenantId, project.accessToken), key);
  }
  for (const grant of initialState.access ?? []) access.set(accessKey(grant.tenantId, grant.projectId, grant.userId), copy(grant));
  for (const log of initialState.logs ?? []) logs.set(recordKey(log.tenantId, log.id), copy(log));
  for (const file of initialState.media ?? []) media.set(recordKey(file.tenantId, file.id), copy(file));
  for (const comment of initialState.comments ?? []) comments.set(recordKey(comment.tenantId, comment.id), copy(comment));

  return {
    async getProject(tenantId, projectId) {
      const project = projects.get(recordKey(tenantId, projectId));
      return project ? copy(project) : null;
    },
    async getProjectByAccessToken(tenantId, accessToken) {
      const key = tokens.get(tokenKey(tenantId, accessToken));
      const project = key ? projects.get(key) : null;
      return project ? copy(project) : null;
    },
    async upsertProject(project) {
      const key = recordKey(project.tenantId, project.id);
      const existing = projects.get(key);
      if (existing) tokens.delete(tokenKey(existing.tenantId, existing.accessToken));
      projects.set(key, copy(project));
      tokens.set(tokenKey(project.tenantId, project.accessToken), key);
    },
    async listProjects(tenantId, input = {}) {
      return [...projects.values()]
        .filter((project) => project.tenantId === tenantId && matches(project, input, access))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, input.limit ?? 50)
        .map(copy);
    },

    async getProjectAccess(tenantId, projectId, userId) {
      const grant = access.get(accessKey(tenantId, projectId, userId));
      return grant ? copy(grant) : null;
    },
    async upsertProjectAccess(grant) {
      access.set(accessKey(grant.tenantId, grant.projectId, grant.userId), copy(grant));
    },
    async deleteProjectAccess(tenantId, projectId, userId) {
      access.delete(accessKey(tenantId, projectId, userId));
    },
    async listProjectAccess(tenantId, projectId) {
      return [...access.values()]
        .filter((grant) => grant.tenantId === tenantId && grant.projectId === projectId)
        .sort((a, b) => a.userId.localeCompare(b.userId))
        .map(copy);
    },

    async insertProgressLog(log) {
      logs.set(recordKey(log.tenantId, log.id), copy(log));
    },
    async getProgressLog(tenantId, logId) {
      const log = logs.get(recordKey(tenantId, logId));
      return log ? copy(log) : null;
    },
    async listProgressLogsByProject(tenantId, projectId) {
      return [...logs.values()]
        .filter((log) => log.tenantId === tenantId && log.projectId === projectId)
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .map(copy);
    },

    async insertMediaFile(file) {
      media.set(recordKey(file.tenantId, file.id), copy(file));
    },
    async listMediaFilesByLog(tenantId, logId) {
      return [...media.values()]
        .filter((file) => file.tenantId === tenantId && file.logId === logId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(copy);
    },

    async insertComment(comment) {
      comments.set(recordKey(comment.tenantId, comment.id), copy(comment));
    },
    async listCommentsByProject(tenantId, projectId) {
      return [...comments.values()]
        .filter((comment) => comment.tenantId === tenantId && comment.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(copy);
    },
    async listCommentsByLog(tenantId, logId) {
      return [...comments.values()]
        .filter((comment) => comment.tenantId === tenantId && comment.logId === logId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(copy);
    }
  };
}
