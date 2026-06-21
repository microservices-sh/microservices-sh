export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  createShortLinkInputSchema,
  deviceTypeSchema,
  shortLinkClickSchema,
  shortLinkSchema,
  urlShortenerConfigSchema,
  urlShortenerRecordSchema
} from "./schemas";
export { defaultUrlShortenerHooks } from "./hooks";
export { urlShortenerEvents } from "./events";
export { urlShortenerPermissions } from "./permissions";
export { urlShortenerResources } from "./resources";
export { createD1UrlShortenerStore } from "./adapters/d1";
export { createUrlShortenerMemoryStore } from "./adapters/memory";
export {
  createSequentialUrlShortenerCodeFactory,
  createSequentialUrlShortenerIdFactory,
  createUrlShortenerService,
  getUrlShortenerModuleStatus
} from "./service";
export type { UrlShortenerStore } from "./ports";
export type { UrlShortenerMemoryStoreState } from "./adapters/memory";
export type { UrlShortenerService, UrlShortenerServiceDeps } from "./service";
export type {
  ClickAnalyticsInput,
  CountByDate,
  CountShare,
  CreateShortLinkInput,
  DeactivateShortLinkInput,
  DeviceType,
  GetShortLinkStatsInput,
  ModuleResult,
  RecentShortLink,
  ResolveShortLinkInput,
  ShortLink,
  ShortLinkClick,
  ShortLinkResolution,
  ShortLinkStats,
  TenantContext,
  UrlShortenerCodeFactory,
  UrlShortenerConfig,
  UrlShortenerIdFactory,
  UrlShortenerIdPrefix,
  UrlShortenerRecord
} from "./types";

export const urlShortenerModule = {
  id: "url-shortener",
  version: "0.1.0"
} as const;
