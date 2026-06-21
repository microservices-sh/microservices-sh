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

export type CommerceSyncRecord = CommerceConnection | ProviderMapping | SyncRun | WebhookReceipt | NormalizedCommerceEnvelope;
