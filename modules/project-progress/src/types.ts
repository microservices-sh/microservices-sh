export interface ProjectProgressConfig {
  enabled: boolean;
}

export type ProjectProgressIdPrefix = "pproj" | "pacc" | "plog" | "pmed" | "pcmt";
export type ProjectProgressIdFactory = (prefix: ProjectProgressIdPrefix) => string;
export type ProjectProgressTokenFactory = () => string;

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export type ProjectStatus = "planning" | "in_progress" | "completed" | "on_hold";
export type ProgressCategory = "painting" | "plumbing" | "masonry" | "electrical" | "carpentry" | "general";
export type ProgressMediaType = "image" | "video";
export type ProjectCommentAuthorType = "customer" | "worker" | "admin";

export interface ProjectProgressProject {
  id: string;
  tenantId: string;
  customerId: string;
  title: string;
  description: string | null;
  location: string | null;
  status: ProjectStatus;
  accessToken: string;
  qrCodeKey: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAccessGrant {
  id: string;
  tenantId: string;
  projectId: string;
  userId: string;
  canUpload: boolean;
  canView: boolean;
  createdById: string | null;
  createdAt: string;
}

export interface ProgressLog {
  id: string;
  tenantId: string;
  projectId: string;
  uploaderId: string;
  category: ProgressCategory;
  description: string | null;
  voiceNoteKey: string | null;
  capturedAt: string;
  createdAt: string;
}

export interface ProgressMediaFile {
  id: string;
  tenantId: string;
  logId: string;
  storageKey: string;
  thumbnailKey: string | null;
  fileType: ProgressMediaType;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ProjectComment {
  id: string;
  tenantId: string;
  projectId: string;
  logId: string | null;
  authorType: ProjectCommentAuthorType;
  authorName: string;
  authorId: string | null;
  content: string;
  createdAt: string;
}

export interface ProjectTimelineEntry {
  log: ProgressLog;
  media: ProgressMediaFile[];
  comments: ProjectComment[];
}

export interface ProjectProgressSnapshot {
  project: ProjectProgressProject;
  access: ProjectAccessGrant[];
  timeline: ProjectTimelineEntry[];
  comments: ProjectComment[];
}

export interface CreateProjectInput {
  customerId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  status?: ProjectStatus;
  qrCodeKey?: string | null;
  startDate?: string | null;
  expectedEndDate?: string | null;
}

export interface UpdateProjectStatusInput {
  projectId: string;
  status: ProjectStatus;
  actualEndDate?: string | null;
}

export interface GrantProjectAccessInput {
  projectId: string;
  userId: string;
  canUpload?: boolean;
  canView?: boolean;
}

export interface RevokeProjectAccessInput {
  projectId: string;
  userId: string;
}

export interface CreateProgressLogInput {
  projectId: string;
  uploaderId?: string | null;
  category?: ProgressCategory;
  description?: string | null;
  voiceNoteKey?: string | null;
  capturedAt?: string | null;
}

export interface AttachProgressMediaInput {
  logId: string;
  storageKey: string;
  thumbnailKey?: string | null;
  fileType: ProgressMediaType;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface AddProjectCommentInput {
  projectId: string;
  logId?: string | null;
  authorType: ProjectCommentAuthorType;
  authorName: string;
  authorId?: string | null;
  content: string;
}

export interface ListProjectsInput {
  customerId?: string;
  userId?: string;
  status?: ProjectStatus;
  limit?: number;
}

export type ProjectProgressRecord =
  | ProjectProgressProject
  | ProjectAccessGrant
  | ProgressLog
  | ProgressMediaFile
  | ProjectComment;

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
