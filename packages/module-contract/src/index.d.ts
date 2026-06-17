export type ModuleStatus = "available" | "planned";

export interface ModuleHook {
  name: string;
  timing: "pre" | "post" | "compute";
  purpose: string;
}

export interface RuntimeContract {
  framework: "hono";
  mount: string;
  bindings: string[];
}

// Nested connection surface (Plan 25 §6). Forward-compat: the canonical shape
// modules move to. TODO(phase3): make this the source and derive the flat
// eventsEmitted/eventsConsumed/hooks fields below from it, then remove them.
export interface ModuleConnections {
  requires: string[];
  optional: string[];
  rpc: {
    exposes: Array<{ method: string; scope?: string | null; public: boolean; input?: string; output?: string }>;
    calls: Array<{ target: string; scope?: string | null; input?: string }>;
  };
  events: { emits: string[]; consumes: string[] };
  hookPoints: Record<string, { kind: "filter" | "guard" | "observer"; input?: string; output?: string; scope?: string | null }>;
  provides: { hooks: Array<{ target: string; handler: string; order: number }> };
}

export interface ModuleContract {
  id: string;
  name: string;
  version: string;
  status: ModuleStatus;
  // "platform"/"sink"/"provider" appear in data today; reconcile to one enum in phase 3.
  category: "core" | "vertical" | "connector" | "platform" | "sink" | "provider";
  summary: string;
  requires: string[];
  optional: string[];
  storage: string[];
  runtime: RuntimeContract;
  eventsEmitted: string[];
  eventsConsumed: string[];
  permissions: string[];
  hooks: ModuleHook[];
  /** Nested connection surface; optional during the phase 2→3 migration window. */
  connections?: ModuleConnections;
  customization: {
    config: string[];
    hooks: string[];
    forkable: boolean;
  };
  quality: {
    tests: { unit: boolean; integration: boolean; fixtures: boolean };
    agentDocs: boolean;
    migrations: boolean;
    upgradeNotes: boolean;
  };
}

export interface ModuleSourceRef {
  type: "git";
  repo: string;
  url: string;
  tag: string;
  ref: string;
  path: string;
}

export interface TemplateContract {
  id: string;
  name: string;
  version: string;
  status: ModuleStatus;
  summary: string;
  targetCustomer: string;
  defaultModules: string[];
  optionalModules: string[];
  targetRuntime: {
    language: "typescript";
    framework: "hono";
    platform: "cloudflare-workers";
    storage: string[];
  };
  defaultConfig: Record<string, unknown>;
  successCriteria: string[];
}

export interface CompositionInput {
  template?: string;
  templateId?: string;
  modules?: string[];
  config?: Record<string, unknown>;
}

export interface ModuleLock {
  schemaVersion: string;
  generatedAt: string;
  registry: {
    id: string;
    contractVersion: string;
  };
  generator: {
    package: string;
    version: string;
  };
  template: {
    id: string;
    version: string;
    source: string;
    sourceRef?: ModuleSourceRef;
    checksum: string;
  } | null;
  modules: Array<{
    id: string;
    version: string;
    source: string;
    checksum: string;
    customizationMode: string;
    contract: {
      mount: string;
      bindings: string[];
      resources: string[];
      permissions: string[];
      hooks: string[];
      events: string[];
      requires: string[];
      secrets: string[];
    };
  }>;
  customizations: {
    config: boolean;
    hooks: string[];
    overlays: string[];
    forks: string[];
  };
}

export interface AppComposition {
  schemaVersion: string;
  compositionId: string;
  template: Pick<TemplateContract, "id" | "name" | "version" | "status" | "summary" | "defaultModules" | "optionalModules">;
  config: Record<string, unknown>;
  modules: ModuleContract[];
  routes: Array<{ module: string; mount: string; framework: string }>;
  bindings: string[];
  storage: string[];
  permissions: string[];
  events: { emitted: string[]; consumed: string[] };
  hooks: Array<ModuleHook & { module: string }>;
  checks: string[];
  upgradePolicy: {
    mode: string;
    lockfile: string;
    compatibleCustomization: string[];
    manualCustomization: string[];
  };
  lock: ModuleLock;
}

export const CONTRACT_VERSION: string;
export function parseModuleRef(value: string, explicitVersion?: string | null): { id: string; version: string | null; raw: string };
export function availableModuleVersions(id: string): string[];
export function moduleReleaseTag(id: string, version: string): string;
export function moduleSourceRef(input: string | Pick<ModuleContract, "id" | "version">, version?: string | null): ModuleSourceRef;
export function listModules(): Array<Pick<ModuleContract, "id" | "name" | "version" | "status" | "category" | "summary" | "requires"> & { mount: string; latestVersion: string; availableVersions: string[]; sourceRef: ModuleSourceRef }>;
export function inspectModule(id: string): ModuleContract;
export function listTemplates(): Array<Pick<TemplateContract, "id" | "name" | "version" | "status" | "summary" | "defaultModules" | "optionalModules">>;
export function inspectTemplate(id: string): TemplateContract;
export function resolveModuleIds(moduleIds: string[]): string[];
export function createModuleLock(modules: ModuleContract[], template?: TemplateContract | null): ModuleLock;
export function composeApp(input?: string | CompositionInput): AppComposition;
