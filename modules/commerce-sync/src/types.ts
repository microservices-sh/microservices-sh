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

export interface NormalizedCommerceAddress {
  name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface NormalizedCommerceCustomerPayload {
  provider: "woocommerce";
  resourceType: "customer";
  externalId: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  billingAddress?: NormalizedCommerceAddress;
  shippingAddress?: NormalizedCommerceAddress;
  createdAt?: string;
  modifiedAt?: string;
}

export interface NormalizedCommerceCategoryRef {
  externalId: string;
  name: string;
  slug?: string;
}

export interface NormalizedCommerceProductPayload {
  provider: "woocommerce";
  resourceType: "product";
  externalId: string;
  name: string;
  slug?: string;
  sku: string;
  description?: string;
  shortDescription?: string;
  priceCents: number;
  regularPriceCents?: number;
  salePriceCents?: number;
  status?: string;
  productType?: string;
  active: boolean;
  categories: NormalizedCommerceCategoryRef[];
  createdAt?: string;
  modifiedAt?: string;
}

export type NormalizedOrderStatus = "draft" | "confirmed" | "invoiced" | "cancelled";

export interface NormalizedCommerceOrderLine {
  externalLineId: string;
  productExternalId?: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  totalCents: number;
}

export interface NormalizedCommerceShippingLine {
  externalLineId: string;
  methodId?: string;
  methodTitle: string;
  totalCents: number;
}

export interface NormalizedCommerceCouponLine {
  externalLineId: string;
  code: string;
  discountCents: number;
  discountTaxCents: number;
}

export interface NormalizedCommerceOrderPayload {
  provider: "woocommerce";
  resourceType: "order";
  externalId: string;
  status: string;
  mappedStatus: NormalizedOrderStatus;
  currency: string;
  customerExternalId?: string;
  billingAddress?: NormalizedCommerceAddress;
  shippingAddress?: NormalizedCommerceAddress;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  lineItems: NormalizedCommerceOrderLine[];
  shippingLines: NormalizedCommerceShippingLine[];
  couponLines: NormalizedCommerceCouponLine[];
  createdAt?: string;
  modifiedAt?: string;
}

export type CommerceRawPayload = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type NormalizedCommercePayload =
  | NormalizedCommerceCustomerPayload
  | NormalizedCommerceProductPayload
  | NormalizedCommerceOrderPayload
  | CommerceRawPayload;

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
  payload: NormalizedCommercePayload;
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
  listProviderMappings(ctx: TenantContext): Promise<ModuleResult<ProviderMapping[]>>;
  listSyncRuns(ctx: TenantContext): Promise<ModuleResult<SyncRun[]>>;
  listWebhookReceipts(ctx: TenantContext): Promise<ModuleResult<WebhookReceipt[]>>;
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
  listProviderMappings(ctx: TenantContext): ModuleResult<ProviderMapping[]>;
  listSyncRuns(ctx: TenantContext): ModuleResult<SyncRun[]>;
  listWebhookReceipts(ctx: TenantContext): ModuleResult<WebhookReceipt[]>;
  recordProviderMapping(ctx: TenantContext, input: RecordProviderMappingInput): ModuleResult<ProviderMapping>;
  startSyncRun(ctx: TenantContext, connectionId: string, resourceType: CommerceResourceType): ModuleResult<SyncRun>;
  completeSyncRun(ctx: TenantContext, runId: string, input: CompleteSyncRunInput): ModuleResult<SyncRun>;
  failSyncRun(ctx: TenantContext, runId: string, errorMessage: string): ModuleResult<SyncRun>;
  recordWebhookReceipt(ctx: TenantContext, input: RecordWebhookReceiptInput): ModuleResult<WebhookReceipt>;
  normalizeCommercePayload(ctx: TenantContext, input: NormalizeCommercePayloadInput): ModuleResult<NormalizedCommerceEnvelope>;
}

export type CommerceSyncRecord = CommerceConnection | ProviderMapping | SyncRun | WebhookReceipt | NormalizedCommerceEnvelope;
