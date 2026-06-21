import type { CommerceSyncStore } from "../ports";
import type {
  CommerceConnection,
  CommerceProvider,
  CommerceRawPayload,
  CommerceResourceType,
  CommerceSyncIdGenerator,
  CommerceSyncMemoryService,
  CommerceSyncService,
  CompleteSyncRunInput,
  CreateCommerceConnectionInput,
  ModuleResult,
  NormalizedCommerceAddress,
  NormalizedCommerceCategoryRef,
  NormalizedCommerceEnvelope,
  NormalizedCommercePayload,
  NormalizeCommercePayloadInput,
  NormalizedOrderStatus,
  ProviderMapping,
  RecordProviderMappingInput,
  RecordWebhookReceiptInput,
  SyncRun,
  TenantContext,
  WebhookReceipt
} from "../types";

export interface CreateCommerceSyncServiceOptions {
  store: CommerceSyncStore;
  idGenerator?: CommerceSyncIdGenerator;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function sequenceId(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

function durableId(prefix: string): string {
  const random = crypto.randomUUID();
  return `${prefix}_${random.replaceAll("-", "").slice(0, 20)}`;
}

function uniqueConstraintFailed(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

function base64Encode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.slice(index, index + 8192));
  }
  return btoa(binary);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export async function verifyWooCommerceWebhookSignature(
  payload: string,
  signature: string | null | undefined,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = base64Encode(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
    return timingSafeEqual(expected, signature);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function moneyCents(value: unknown): number {
  const amount = numberValue(value);
  return amount == null ? 0 : Math.round(amount * 100);
}

function fullName(firstName: unknown, lastName: unknown): string | undefined {
  return text([text(firstName), text(lastName)].filter(Boolean).join(" "));
}

function dateString(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const candidate = raw.includes("T") && !/(z|[+-]\d{2}:?\d{2})$/i.test(raw) ? `${raw}Z` : raw;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function wooDate(record: Record<string, unknown>, field: string): string | undefined {
  return dateString(record[`${field}_gmt`]) ?? dateString(record[field]);
}

function wooAddress(address: Record<string, unknown> | undefined): NormalizedCommerceAddress | undefined {
  if (!address) return undefined;
  const normalized: NormalizedCommerceAddress = {
    name: fullName(address.first_name, address.last_name),
    company: text(address.company),
    address1: text(address.address_1),
    address2: text(address.address_2),
    city: text(address.city),
    state: text(address.state),
    postalCode: text(address.postcode),
    country: text(address.country),
    email: text(address.email),
    phone: text(address.phone)
  };
  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

function wooCategories(value: unknown): NormalizedCommerceCategoryRef[] {
  return recordArray(value).map((category) => {
    const externalId = text(category.id) ?? text(category.slug) ?? text(category.name) ?? "unknown";
    return {
      externalId,
      name: text(category.name) ?? `Category ${externalId}`,
      slug: text(category.slug)
    };
  });
}

function wooOrderStatus(status: string): NormalizedOrderStatus {
  switch (status) {
    case "completed":
      return "invoiced";
    case "processing":
    case "pending":
    case "on-hold":
      return "confirmed";
    case "cancelled":
    case "refunded":
    case "failed":
      return "cancelled";
    default:
      return "draft";
  }
}

function normalizeWooCustomer(externalId: string, payload: Record<string, unknown>): NormalizedCommercePayload {
  const billingAddress = wooAddress(recordValue(payload, "billing"));
  const shippingAddress = wooAddress(recordValue(payload, "shipping"));
  const name =
    fullName(payload.first_name, payload.last_name) ??
    billingAddress?.name ??
    text(payload.email) ??
    `WooCommerce customer ${externalId}`;

  return {
    provider: "woocommerce",
    resourceType: "customer",
    externalId,
    name,
    email: text(payload.email) ?? billingAddress?.email,
    phone: billingAddress?.phone,
    username: text(payload.username),
    billingAddress,
    shippingAddress,
    createdAt: wooDate(payload, "date_created"),
    modifiedAt: wooDate(payload, "date_modified")
  };
}

function normalizeWooProduct(externalId: string, payload: Record<string, unknown>): NormalizedCommercePayload {
  const sku = text(payload.sku) ?? `WC-${externalId}`;
  const status = text(payload.status);
  const description = text(payload.description);

  return {
    provider: "woocommerce",
    resourceType: "product",
    externalId,
    name: text(payload.name) ?? sku,
    slug: text(payload.slug),
    sku,
    description: text(payload.short_description) ?? description?.slice(0, 500),
    shortDescription: text(payload.short_description),
    priceCents: moneyCents(payload.price ?? payload.regular_price),
    regularPriceCents: payload.regular_price == null ? undefined : moneyCents(payload.regular_price),
    salePriceCents: payload.sale_price == null ? undefined : moneyCents(payload.sale_price),
    status,
    productType: text(payload.type),
    active: status ? status === "publish" : true,
    categories: wooCategories(payload.categories),
    createdAt: wooDate(payload, "date_created"),
    modifiedAt: wooDate(payload, "date_modified")
  };
}

function normalizeWooOrder(externalId: string, payload: Record<string, unknown>): NormalizedCommercePayload {
  const status = text(payload.status) ?? "draft";
  const lineItems = recordArray(payload.line_items).map((item, index) => {
    const quantity = numberValue(item.quantity) ?? 0;
    const totalCents = moneyCents(item.total);
    const unitPriceCents = moneyCents(item.price) || (quantity > 0 ? Math.round(totalCents / quantity) : 0);
    return {
      externalLineId: text(item.id) ?? `${externalId}-line-${index + 1}`,
      productExternalId: text(item.product_id),
      sku: text(item.sku),
      name: text(item.name) ?? "Line item",
      quantity,
      unitPriceCents,
      subtotalCents: moneyCents(item.subtotal),
      totalCents
    };
  });
  const shippingLines = recordArray(payload.shipping_lines).map((line, index) => ({
    externalLineId: text(line.id) ?? `${externalId}-shipping-${index + 1}`,
    methodId: text(line.method_id),
    methodTitle: text(line.method_title) ?? "Shipping",
    totalCents: moneyCents(line.total)
  }));
  const couponLines = recordArray(payload.coupon_lines).map((line, index) => ({
    externalLineId: text(line.id) ?? `${externalId}-coupon-${index + 1}`,
    code: text(line.code) ?? "coupon",
    discountCents: moneyCents(line.discount),
    discountTaxCents: moneyCents(line.discount_tax)
  }));
  const shippingCents = moneyCents(payload.shipping_total) || shippingLines.reduce((sum, line) => sum + line.totalCents, 0);
  const lineSubtotalCents = lineItems.reduce((sum, item) => sum + (item.subtotalCents || item.totalCents), 0);
  const billingAddress = wooAddress(recordValue(payload, "billing"));
  const shippingAddress = wooAddress(recordValue(payload, "shipping"));

  return {
    provider: "woocommerce",
    resourceType: "order",
    externalId,
    status,
    mappedStatus: wooOrderStatus(status),
    currency: text(payload.currency) ?? "USD",
    customerExternalId: text(payload.customer_id),
    billingAddress,
    shippingAddress: shippingAddress ?? billingAddress,
    subtotalCents: lineSubtotalCents + shippingCents,
    discountCents: moneyCents(payload.discount_total),
    taxCents: moneyCents(payload.total_tax),
    shippingCents,
    totalCents: moneyCents(payload.total),
    lineItems,
    shippingLines,
    couponLines,
    createdAt: wooDate(payload, "date_created"),
    modifiedAt: wooDate(payload, "date_modified")
  };
}

export function normalizeCommerceProviderPayload(
  provider: CommerceProvider,
  resourceType: CommerceResourceType,
  externalId: string,
  payload: unknown
): NormalizedCommercePayload {
  if (provider !== "woocommerce" || !isRecord(payload)) return payload as CommerceRawPayload;
  if (resourceType === "customer") return normalizeWooCustomer(externalId, payload);
  if (resourceType === "product") return normalizeWooProduct(externalId, payload);
  if (resourceType === "order") return normalizeWooOrder(externalId, payload);
  return payload as CommerceRawPayload;
}

export function createCommerceSyncService(options: CreateCommerceSyncServiceOptions): CommerceSyncService {
  const { store, idGenerator = durableId } = options;

  async function requireConnection(ctx: TenantContext, connectionId: string): Promise<CommerceConnection | null> {
    return store.getConnection(ctx.tenantId, connectionId);
  }

  return {
    async createCommerceConnection(ctx, input) {
      if (!input.secretRef.trim()) return fail("secret_ref_required", "Provider credentials must be stored as an opaque secret reference.");
      const createdAt = now(ctx);
      const connection: CommerceConnection = {
        id: idGenerator("csconn"),
        tenantId: ctx.tenantId,
        provider: input.provider,
        name: input.name,
        baseUrl: input.baseUrl,
        secretRef: input.secretRef,
        active: true,
        createdAt,
        updatedAt: createdAt
      };
      await store.insertConnection(connection);
      return ok(connection);
    },

    async listCommerceConnections(ctx) {
      return ok(await store.listConnections(ctx.tenantId));
    },

    async listProviderMappings(ctx) {
      return ok(await store.listMappings(ctx.tenantId));
    },

    async listSyncRuns(ctx) {
      return ok(await store.listSyncRuns(ctx.tenantId));
    },

    async listWebhookReceipts(ctx) {
      return ok(await store.listWebhookReceipts(ctx.tenantId));
    },

    async recordProviderMapping(ctx, input) {
      const connection = await requireConnection(ctx, input.connectionId);
      if (!connection) return fail("connection_not_found", "Commerce connection not found.");

      const existing = await store.findMappingByExternal(ctx.tenantId, connection.provider, input.resourceType, input.externalId);
      if (existing) return ok(existing);

      const createdAt = now(ctx);
      const mapping: ProviderMapping = {
        id: idGenerator("csmap"),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        provider: connection.provider,
        resourceType: input.resourceType,
        externalId: input.externalId,
        internalId: input.internalId,
        createdAt,
        updatedAt: createdAt
      };

      try {
        await store.insertMapping(mapping);
      } catch (error) {
        if (uniqueConstraintFailed(error)) {
          const replayed = await store.findMappingByExternal(ctx.tenantId, connection.provider, input.resourceType, input.externalId);
          if (replayed) return ok(replayed);
        }
        throw error;
      }

      return ok(mapping);
    },

    async startSyncRun(ctx, connectionId, resourceType) {
      if (!(await requireConnection(ctx, connectionId))) return fail("connection_not_found", "Commerce connection not found.");
      const startedAt = now(ctx);
      const run: SyncRun = {
        id: idGenerator("csrun"),
        tenantId: ctx.tenantId,
        connectionId,
        resourceType,
        status: "running",
        startedAt,
        processedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        failedCount: 0
      };
      await store.insertSyncRun(run);
      return ok(run);
    },

    async completeSyncRun(ctx, runId, input) {
      const run = await store.getSyncRun(ctx.tenantId, runId);
      if (!run) return fail("sync_run_not_found", "Sync run not found.");
      if (run.status !== "running") return fail("sync_run_closed", "Only running sync runs can be completed.");
      const completed: SyncRun = { ...run, ...input, status: "completed", completedAt: now(ctx) };
      await store.updateSyncRun(completed);
      return ok(completed);
    },

    async failSyncRun(ctx, runId, errorMessage) {
      const run = await store.getSyncRun(ctx.tenantId, runId);
      if (!run) return fail("sync_run_not_found", "Sync run not found.");
      if (run.status !== "running") return fail("sync_run_closed", "Only running sync runs can fail.");
      const failed: SyncRun = { ...run, status: "failed", completedAt: now(ctx), errorMessage };
      await store.updateSyncRun(failed);
      return ok(failed);
    },

    async recordWebhookReceipt(ctx, input) {
      if (!(await requireConnection(ctx, input.connectionId))) return fail("connection_not_found", "Commerce connection not found.");

      const existing = await store.findWebhookReceiptByIdempotency(ctx.tenantId, input.connectionId, input.idempotencyKey);
      if (existing) return ok({ ...existing, replayed: true });

      const receipt: WebhookReceipt = {
        id: idGenerator("cswh"),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        topic: input.topic,
        idempotencyKey: input.idempotencyKey,
        signature: input.signature,
        payload: input.payload,
        replayed: false,
        receivedAt: now(ctx)
      };

      try {
        await store.insertWebhookReceipt(receipt);
      } catch (error) {
        if (uniqueConstraintFailed(error)) {
          const replayed = await store.findWebhookReceiptByIdempotency(ctx.tenantId, input.connectionId, input.idempotencyKey);
          if (replayed) return ok({ ...replayed, replayed: true });
        }
        throw error;
      }

      return ok(receipt);
    },

    async normalizeCommercePayload(ctx, input) {
      const connection = await requireConnection(ctx, input.connectionId);
      if (!connection) return fail("connection_not_found", "Commerce connection not found.");
      const envelope: NormalizedCommerceEnvelope = {
        id: idGenerator("csenv"),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        resourceType: input.resourceType,
        externalId: input.externalId,
        payload: normalizeCommerceProviderPayload(connection.provider, input.resourceType, input.externalId, input.payload),
        receivedAt: now(ctx)
      };
      await store.insertEnvelope(envelope);
      return ok(envelope);
    }
  };
}

export function createCommerceSyncMemoryService(): CommerceSyncMemoryService {
  const connections = new Map<string, CommerceConnection>();
  const mappings = new Map<string, ProviderMapping>();
  const mappingKeys = new Map<string, string>();
  const runs = new Map<string, SyncRun>();
  const receipts = new Map<string, WebhookReceipt>();
  const receiptKeys = new Map<string, string>();
  const envelopes = new Map<string, NormalizedCommerceEnvelope>();
  let connectionSequence = 0;
  let mappingSequence = 0;
  let runSequence = 0;
  let receiptSequence = 0;
  let envelopeSequence = 0;

  function requireConnection(ctx: TenantContext, connectionId: string): CommerceConnection | null {
    const connection = connections.get(connectionId);
    return connection && connection.tenantId === ctx.tenantId ? connection : null;
  }

  return {
    createCommerceConnection(ctx: TenantContext, input: CreateCommerceConnectionInput): ModuleResult<CommerceConnection> {
      if (!input.secretRef.trim()) return fail("secret_ref_required", "Provider credentials must be stored as an opaque secret reference.");
      const createdAt = now(ctx);
      const connection: CommerceConnection = {
        id: sequenceId("csconn", ++connectionSequence),
        tenantId: ctx.tenantId,
        provider: input.provider,
        name: input.name,
        baseUrl: input.baseUrl,
        secretRef: input.secretRef,
        active: true,
        createdAt,
        updatedAt: createdAt
      };
      connections.set(connection.id, connection);
      return ok(connection);
    },

    listCommerceConnections(ctx: TenantContext): ModuleResult<CommerceConnection[]> {
      return ok([...connections.values()].filter((connection) => connection.tenantId === ctx.tenantId));
    },

    listProviderMappings(ctx: TenantContext): ModuleResult<ProviderMapping[]> {
      return ok(
        [...mappings.values()]
          .filter((mapping) => mapping.tenantId === ctx.tenantId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    },

    listSyncRuns(ctx: TenantContext): ModuleResult<SyncRun[]> {
      return ok(
        [...runs.values()]
          .filter((run) => run.tenantId === ctx.tenantId)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      );
    },

    listWebhookReceipts(ctx: TenantContext): ModuleResult<WebhookReceipt[]> {
      return ok(
        [...receipts.values()]
          .filter((receipt) => receipt.tenantId === ctx.tenantId)
          .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      );
    },

    recordProviderMapping(ctx: TenantContext, input: RecordProviderMappingInput): ModuleResult<ProviderMapping> {
      const connection = requireConnection(ctx, input.connectionId);
      if (!connection) return fail("connection_not_found", "Commerce connection not found.");
      const key = `${ctx.tenantId}:${connection.provider}:${input.resourceType}:${input.externalId}`;
      const existing = mappingKeys.get(key);
      if (existing) return ok(mappings.get(existing)!);
      const createdAt = now(ctx);
      const mapping: ProviderMapping = {
        id: sequenceId("csmap", ++mappingSequence),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        provider: connection.provider,
        resourceType: input.resourceType,
        externalId: input.externalId,
        internalId: input.internalId,
        createdAt,
        updatedAt: createdAt
      };
      mappings.set(mapping.id, mapping);
      mappingKeys.set(key, mapping.id);
      return ok(mapping);
    },

    startSyncRun(ctx: TenantContext, connectionId: string, resourceType: CommerceResourceType): ModuleResult<SyncRun> {
      if (!requireConnection(ctx, connectionId)) return fail("connection_not_found", "Commerce connection not found.");
      const startedAt = now(ctx);
      const run: SyncRun = {
        id: sequenceId("csrun", ++runSequence),
        tenantId: ctx.tenantId,
        connectionId,
        resourceType,
        status: "running",
        startedAt,
        processedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        failedCount: 0
      };
      runs.set(run.id, run);
      return ok(run);
    },

    completeSyncRun(ctx: TenantContext, runId: string, input: CompleteSyncRunInput): ModuleResult<SyncRun> {
      const run = runs.get(runId);
      if (!run || run.tenantId !== ctx.tenantId) return fail("sync_run_not_found", "Sync run not found.");
      if (run.status !== "running") return fail("sync_run_closed", "Only running sync runs can be completed.");
      const completed: SyncRun = { ...run, ...input, status: "completed", completedAt: now(ctx) };
      runs.set(completed.id, completed);
      return ok(completed);
    },

    failSyncRun(ctx: TenantContext, runId: string, errorMessage: string): ModuleResult<SyncRun> {
      const run = runs.get(runId);
      if (!run || run.tenantId !== ctx.tenantId) return fail("sync_run_not_found", "Sync run not found.");
      if (run.status !== "running") return fail("sync_run_closed", "Only running sync runs can fail.");
      const failed: SyncRun = { ...run, status: "failed", completedAt: now(ctx), errorMessage };
      runs.set(failed.id, failed);
      return ok(failed);
    },

    recordWebhookReceipt(ctx: TenantContext, input: RecordWebhookReceiptInput): ModuleResult<WebhookReceipt> {
      if (!requireConnection(ctx, input.connectionId)) return fail("connection_not_found", "Commerce connection not found.");
      const key = `${ctx.tenantId}:${input.connectionId}:${input.idempotencyKey}`;
      const existing = receiptKeys.get(key);
      if (existing) return ok({ ...receipts.get(existing)!, replayed: true });
      const receipt: WebhookReceipt = {
        id: sequenceId("cswh", ++receiptSequence),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        topic: input.topic,
        idempotencyKey: input.idempotencyKey,
        signature: input.signature,
        payload: input.payload,
        replayed: false,
        receivedAt: now(ctx)
      };
      receipts.set(receipt.id, receipt);
      receiptKeys.set(key, receipt.id);
      return ok(receipt);
    },

    normalizeCommercePayload(ctx: TenantContext, input: NormalizeCommercePayloadInput): ModuleResult<NormalizedCommerceEnvelope> {
      const connection = requireConnection(ctx, input.connectionId);
      if (!connection) return fail("connection_not_found", "Commerce connection not found.");
      const envelope: NormalizedCommerceEnvelope = {
        id: sequenceId("csenv", ++envelopeSequence),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        resourceType: input.resourceType,
        externalId: input.externalId,
        payload: normalizeCommerceProviderPayload(connection.provider, input.resourceType, input.externalId, input.payload),
        receivedAt: now(ctx)
      };
      envelopes.set(envelope.id, envelope);
      return ok(envelope);
    }
  };
}

export function getCommerceSyncModuleStatus() {
  return { id: "commerce-sync", status: "draft" } as const;
}
