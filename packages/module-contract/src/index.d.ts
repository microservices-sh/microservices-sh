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

export interface ModuleContract {
  id: string;
  name: string;
  version: string;
  status: ModuleStatus;
  category: "core" | "vertical" | "connector";
  summary: string;
  requires: string[];
  optional: string[];
  storage: string[];
  runtime: RuntimeContract;
  eventsEmitted: string[];
  eventsConsumed: string[];
  permissions: string[];
  hooks: ModuleHook[];
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
export function listModules(): Array<Pick<ModuleContract, "id" | "name" | "version" | "status" | "category" | "summary" | "requires"> & { mount: string }>;
export function inspectModule(id: string): ModuleContract;
export function listTemplates(): Array<Pick<TemplateContract, "id" | "name" | "version" | "status" | "summary" | "defaultModules" | "optionalModules">>;
export function inspectTemplate(id: string): TemplateContract;
export function resolveModuleIds(moduleIds: string[]): string[];
export function createModuleLock(modules: ModuleContract[], template?: TemplateContract | null): ModuleLock;
export function composeApp(input?: string | CompositionInput): AppComposition;
