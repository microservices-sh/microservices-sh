export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema, adsManagerConfigSchema } from "./config";
export type { AdsManagerConfig } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { beforeSync, onAlertRaised } from "./hooks";

// Use-cases
export { connectAccount } from "./use-cases/connect-account";
export { listConnections } from "./use-cases/list-connections";
export { disconnectAccount } from "./use-cases/disconnect-account";
export { listCampaigns } from "./use-cases/list-campaigns";
export { getInsights } from "./use-cases/get-insights";
export { syncInsights } from "./use-cases/sync-insights";
export { detectAnomalies } from "./use-cases/detect-anomalies";
export { listAlerts } from "./use-cases/list-alerts";

// Service wiring
export { buildConnector } from "./service";
export type { AdsServiceEnv } from "./service";

// Keys / errors
export { snapshotId, alertDedupeKey, belongsToTenant } from "./keys";
export { AdsServiceError } from "./adapters/openclaw-connector";

// Adapters
export { createMemoryAdsStore } from "./adapters/memory-ads-store";
export { createD1AdsStore } from "./adapters/d1-ads-store";
export { createMemoryConnector } from "./adapters/memory-connector";
export { createOpenclawConnector } from "./adapters/openclaw-connector";
export { createMemoryEntitlement } from "./adapters/memory-entitlement";

// Ports & types
export type { AdsConnector, AdsStore, Entitlement, ConnectionInput, SnapshotFilter, AlertFilter } from "./ports";
export type {
  AdPlatform,
  AdConnection,
  NormalizedCampaign,
  InsightRow,
  InsightSnapshot,
  AdAlert,
  AlertType,
  ConnectorContext,
  DateRange,
} from "./types";
