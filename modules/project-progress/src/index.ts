export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  addProjectCommentInputSchema,
  attachProgressMediaInputSchema,
  createProgressLogInputSchema,
  createProjectInputSchema,
  grantProjectAccessInputSchema,
  listProjectsInputSchema,
  progressCategorySchema,
  progressLogSchema,
  progressMediaFileSchema,
  progressMediaTypeSchema,
  projectAccessGrantSchema,
  projectCommentAuthorTypeSchema,
  projectCommentSchema,
  projectProgressConfigSchema,
  projectProgressProjectSchema,
  projectProgressRecordSchema,
  projectProgressSnapshotSchema,
  projectStatusSchema,
  projectTimelineEntrySchema,
  revokeProjectAccessInputSchema,
  updateProjectStatusInputSchema
} from "./schemas";
export { defaultProjectProgressHooks } from "./hooks";
export { projectProgressEvents } from "./events";
export { projectProgressPermissions } from "./permissions";
export { projectProgressResources } from "./resources";
export { createD1ProjectProgressStore } from "./adapters/d1";
export { createProjectProgressMemoryStore } from "./adapters/memory";
export {
  createProjectProgressService,
  createSequentialProjectProgressIdFactory,
  createSequentialProjectProgressTokenFactory,
  getProjectProgressModuleStatus
} from "./service";
export type { ProjectProgressStore } from "./ports";
export type { ProjectProgressMemoryStoreState } from "./adapters/memory";
export type { ProjectProgressService, ProjectProgressServiceDeps } from "./service";
export type {
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
  ProgressMediaType,
  ProjectAccessGrant,
  ProjectComment,
  ProjectCommentAuthorType,
  ProjectProgressConfig,
  ProjectProgressIdFactory,
  ProjectProgressIdPrefix,
  ProjectProgressProject,
  ProjectProgressRecord,
  ProjectProgressSnapshot,
  ProjectProgressTokenFactory,
  ProjectStatus,
  ProjectTimelineEntry,
  RevokeProjectAccessInput,
  TenantContext,
  UpdateProjectStatusInput
} from "./types";

export const projectProgressModule = {
  id: "project-progress",
  version: "0.1.0"
} as const;
