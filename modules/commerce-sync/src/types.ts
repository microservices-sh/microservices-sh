export interface CommerceSyncConfig {
  enabled: boolean;
}

export type CommerceProvider = "woocommerce" | "shopify" | "custom";
export type CommerceResourceType = "customer" | "product" | "order" | "category" | "inventory";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface CreateCommerceConnectionInput {
  provider: CommerceProvider;
  name: string;
  baseUrl?: string;
  secretRef: string;
}

export interface RecordProviderMappingInput {
  connectionId: string;
  resourceType: CommerceResourceType;
  externalId: string;
  internalId: string;
}

export interface CompleteSyncRunInput {
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
}

export interface RecordWebhookReceiptInput {
  connectionId: string;
  topic: string;
  idempotencyKey: string;
  signature?: string;
  payload: unknown;
}

export interface NormalizeCommercePayloadInput {
  connectionId: string;
  resourceType: CommerceResourceType;
  externalId: string;
  payload: unknown;
}

export interface CommerceConnection {
  id: string;
  tenantId: string;
  provider: CommerceProvider;
  name: string;
  baseUrl?: string;
  secretRef: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderMapping {
  id: string;
  tenantId: string;
  connectionId: string;
  provider: CommerceProvider;
  resourceType: CommerceResourceType;
  externalId: string;
  internalId: string;
  createdAt: string;
  updatedAt: string;
}

export type SyncRunStatus = "running" | "completed" | "failed";

export interface SyncRun {
  id: string;
  tenantId: string;
  connectionId: string;
  resourceType: CommerceResourceType;
  status: SyncRunStatus;
  startedAt: string;
  completedAt?: string;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errorMessage?: string;
}

export interface WebhookReceipt {
  id: string;
  tenantId: string;
  connectionId: string;
  topic: string;
  idempotencyKey: string;
  signature?: string;
  payload: unknown;
  replayed: boolean;
  receivedAt: string;
}

export interface NormalizedCommerceEnvelope {
  id: string;
  tenantId: string;
  connectionId: string;
  resourceType: CommerceResourceType;
  externalId: string;
  payload: unknown;
  receivedAt: string;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type CommerceSyncIdGenerator = (prefix: string) => string;

export interface CommerceSyncService {
  createCommerceConnection(
    ctx: TenantContext,
    input: CreateCommerceConnectionInput
  ): Promise<ModuleResult<CommerceConnection>>;
  listCommerceConnections(ctx: TenantContext): Promise<ModuleResult<CommerceConnection[]>>;
  recordProviderMapping(ctx: TenantContext, input: RecordProviderMappingInput): Promise<ModuleResult<ProviderMapping>>;
  startSyncRun(ctx: TenantContext, connectionId: string, resourceType: CommerceResourceType): Promise<ModuleResult<SyncRun>>;
  completeSyncRun(ctx: TenantContext, runId: string, input: CompleteSyncRunInput): Promise<ModuleResult<SyncRun>>;
  failSyncRun(ctx: TenantContext, runId: string, errorMessage: string): Promise<ModuleResult<SyncRun>>;
  recordWebhookReceipt(ctx: TenantContext, input: RecordWebhookReceiptInput): Promise<ModuleResult<WebhookReceipt>>;
  normalizeCommercePayload(
    ctx: TenantContext,
    input: NormalizeCommercePayloadInput
  ): Promise<ModuleResult<NormalizedCommerceEnvelope>>;
}

export interface CommerceSyncMemoryService {
  createCommerceConnection(ctx: TenantContext, input: CreateCommerceConnectionInput): ModuleResult<CommerceConnection>;
  listCommerceConnections(ctx: TenantContext): ModuleResult<CommerceConnection[]>;
  recordProviderMapping(ctx: TenantContext, input: RecordProviderMappingInput): ModuleResult<ProviderMapping>;
  startSyncRun(ctx: TenantContext, connectionId: string, resourceType: CommerceResourceType): ModuleResult<SyncRun>;
  completeSyncRun(ctx: TenantContext, runId: string, input: CompleteSyncRunInput): ModuleResult<SyncRun>;
  failSyncRun(ctx: TenantContext, runId: string, errorMessage: string): ModuleResult<SyncRun>;
  recordWebhookReceipt(ctx: TenantContext, input: RecordWebhookReceiptInput): ModuleResult<WebhookReceipt>;
  normalizeCommercePayload(ctx: TenantContext, input: NormalizeCommercePayloadInput): ModuleResult<NormalizedCommerceEnvelope>;
}

export type CommerceSyncRecord = CommerceConnection | ProviderMapping | SyncRun | WebhookReceipt | NormalizedCommerceEnvelope;
