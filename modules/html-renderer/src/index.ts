export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  createHtmlRenderInputSchema,
  htmlRenderAssetSchema,
  htmlRenderDocumentSchema,
  htmlRendererConfigSchema,
  htmlRendererRecordSchema
} from "./schemas";
export { defaultHtmlRendererHooks } from "./hooks";
export { htmlRendererEvents } from "./events";
export { htmlRendererPermissions } from "./permissions";
export { htmlRendererResources } from "./resources";
export { createD1HtmlRendererStore } from "./adapters/d1";
export { createHtmlRendererMemoryStore } from "./adapters/memory";
export {
  createHtmlRendererService,
  createSequentialHtmlRendererIdFactory,
  createSequentialHtmlRendererSlugFactory,
  getHtmlRendererModuleStatus
} from "./service";
export type { HtmlRendererStore } from "./ports";
export type { HtmlRendererMemoryStoreState } from "./adapters/memory";
export type { HtmlRendererService, HtmlRendererServiceDeps } from "./service";
export type {
  CreateHtmlRenderInput,
  DeleteHtmlRenderInput,
  HtmlDocumentStatus,
  HtmlRenderAsset,
  HtmlRenderDocument,
  HtmlRendererConfig,
  HtmlRendererIdFactory,
  HtmlRendererIdPrefix,
  HtmlRendererRecord,
  HtmlRendererSlugFactory,
  ModuleResult,
  ResolveHtmlRenderInput,
  TenantContext
} from "./types";

export const htmlRendererModule = {
  id: "html-renderer",
  version: "0.1.0"
} as const;
