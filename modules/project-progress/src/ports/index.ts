import type {
  ListProjectsInput,
  ProgressLog,
  ProgressMediaFile,
  ProjectAccessGrant,
  ProjectComment,
  ProjectProgressProject
} from "../types";

export interface ProjectProgressStore {
  getProject(tenantId: string, projectId: string): Promise<ProjectProgressProject | null>;
  getProjectByAccessToken(tenantId: string, accessToken: string): Promise<ProjectProgressProject | null>;
  upsertProject(project: ProjectProgressProject): Promise<void>;
  listProjects(tenantId: string, input?: ListProjectsInput): Promise<ProjectProgressProject[]>;

  getProjectAccess(tenantId: string, projectId: string, userId: string): Promise<ProjectAccessGrant | null>;
  upsertProjectAccess(access: ProjectAccessGrant): Promise<void>;
  deleteProjectAccess(tenantId: string, projectId: string, userId: string): Promise<void>;
  listProjectAccess(tenantId: string, projectId: string): Promise<ProjectAccessGrant[]>;

  insertProgressLog(log: ProgressLog): Promise<void>;
  getProgressLog(tenantId: string, logId: string): Promise<ProgressLog | null>;
  listProgressLogsByProject(tenantId: string, projectId: string): Promise<ProgressLog[]>;

  insertMediaFile(file: ProgressMediaFile): Promise<void>;
  listMediaFilesByLog(tenantId: string, logId: string): Promise<ProgressMediaFile[]>;

  insertComment(comment: ProjectComment): Promise<void>;
  listCommentsByProject(tenantId: string, projectId: string): Promise<ProjectComment[]>;
  listCommentsByLog(tenantId: string, logId: string): Promise<ProjectComment[]>;
}
