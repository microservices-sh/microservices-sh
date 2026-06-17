import type { AppComposition, ModuleContract, TemplateContract } from "@microservices-sh/module-contract";

export interface SdkError {
  code: string;
  message: string;
  remediation: string;
  details: Record<string, unknown>;
}

export type SdkResponse<T> =
  | { ok: true; requestId: string; data: T; warnings: string[] }
  | { ok: false; requestId: string; error: SdkError };

export interface GeneratedFile {
  path: string;
  contents: string;
}

export interface GeneratedProject {
  composition: AppComposition;
  files: GeneratedFile[];
  nextSteps: string[];
}

export interface CheckResult {
  status: "pass" | "pending" | "fail";
  checks: Array<{ id: string; status: "pass" | "pending" | "fail"; message: string }>;
}

export interface ModuleDocSummary {
  id: string;
  name: string;
  status: string;
  docPath: string;
  summary: string;
  approvalRisk: string;
}

export interface ModuleDoc {
  id: string;
  path: string;
  markdown: string;
  module: Record<string, unknown>;
}

export interface AddModulePlan {
  module: Record<string, unknown>;
  requestedVersion: string;
  availableVersions: string[];
  action: "already-installed" | "install" | "planned-install";
  alreadyInstalled: boolean;
  missingDependencies: string[];
  approvalRequired: boolean;
  requiredSecrets: string[];
  requiredResources: string[];
  requiredPermissions: string[];
  filesLikelyTouched: string[];
  nextSteps: string[];
}

export interface SecretStatus {
  module: string;
  name: string;
  configured: boolean;
  scope: string;
  valueVisibleToAgent: boolean;
}

export interface UpdateCheck {
  schemaVersion: string | null;
  registryVersion: string;
  template: Record<string, unknown> | null;
  current: Array<{ id: string; currentVersion: string; latestVersion: string; availableVersions: string[]; direction: "upgrade" | "downgrade" | "none"; status: "current" | "update-available" }>;
  available: Array<{ id: string; currentVersion: string; latestVersion: string; availableVersions: string[]; direction: "upgrade" | "downgrade"; status: "update-available" }>;
  unavailable: Array<{ id: string; currentVersion: string; reason: string; availableVersions?: string[] }>;
  policy: Record<string, unknown>;
}

export interface ModuleUpgradePlan {
  module: {
    id: string;
    name: string;
    status: string;
    currentVersion: string;
    targetVersion: string;
    requestedVersion: string;
    availableVersions: string[];
  };
  action: "upgrade-plan" | "downgrade-plan" | "no-op";
  direction: "upgrade" | "downgrade" | "none";
  upgradeAvailable: boolean;
  versionChangeAvailable: boolean;
  approvalRequired: boolean;
  risk: "low" | "medium" | "high";
  lockfile: {
    schemaVersion: string | null;
    registryVersion: string;
    template: Record<string, unknown> | null;
    source: string | null;
    checksum: string | null;
    contractSnapshotAvailable: boolean;
  };
  diff: Record<string, unknown>;
  customizationImpact: {
    configPreserved: boolean;
    hooksToReview: string[];
    overlaysToReview: unknown[];
    forksToReview: unknown[];
  };
  filesLikelyTouched: string[];
  permissionGate: {
    required: boolean;
    reasons: string[];
  };
  nextSteps: string[];
}

export function listTemplates(): SdkResponse<Array<Pick<TemplateContract, "id" | "name" | "version" | "status" | "summary" | "defaultModules" | "optionalModules">>>;
export function inspectTemplate(id: string): SdkResponse<TemplateContract>;
export function listModules(): SdkResponse<Array<Pick<ModuleContract, "id" | "name" | "version" | "status" | "category" | "summary" | "requires"> & { mount: string }>>;
export function inspectModule(id: string): SdkResponse<ModuleContract>;
export function listModuleDocs(): SdkResponse<ModuleDocSummary[]>;
export function getModuleDoc(id: string): SdkResponse<ModuleDoc>;
export function planAddModule(input?: Record<string, unknown> | string): SdkResponse<AddModulePlan>;
export function getSecretsStatus(input?: Record<string, unknown>): SdkResponse<{ secrets: SecretStatus[] }>;
export function checkUpdates(input?: Record<string, unknown>): SdkResponse<UpdateCheck>;
export function planModuleUpgrade(input?: Record<string, unknown> | string): SdkResponse<ModuleUpgradePlan>;
export function composeApp(input?: Record<string, unknown> | string): SdkResponse<AppComposition>;
export function validateConfig(input?: Record<string, unknown>): SdkResponse<{
  valid: boolean;
  warnings: string[];
  requiredBindings: string[];
  requiredStorage: string[];
  customizationMode: string[];
}>;
export function generateProject(input?: Record<string, unknown>): SdkResponse<GeneratedProject>;
export function runChecks(input?: Record<string, unknown>): SdkResponse<CheckResult>;
export function createMicroservicesClient(): {
  listTemplates: typeof listTemplates;
  inspectTemplate: typeof inspectTemplate;
  listModules: typeof listModules;
  inspectModule: typeof inspectModule;
  listModuleDocs: typeof listModuleDocs;
  getModuleDoc: typeof getModuleDoc;
  planAddModule: typeof planAddModule;
  getSecretsStatus: typeof getSecretsStatus;
  checkUpdates: typeof checkUpdates;
  planModuleUpgrade: typeof planModuleUpgrade;
  composeApp: typeof composeApp;
  validateConfig: typeof validateConfig;
  generateProject: typeof generateProject;
  runChecks: typeof runChecks;
};
