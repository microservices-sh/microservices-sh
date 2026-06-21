import type { CommerceResourceType, CommerceSyncService, ModuleResult, NormalizedCommercePayload, TenantContext } from "../types";
import type { WooCommerceClient } from "../providers/woocommerce";

export type WooCommerceSyncPageResourceType = Extract<CommerceResourceType, "customer" | "product" | "order" | "category">;

export interface SyncWooCommercePageInput {
  connectionId: string;
  resourceType: WooCommerceSyncPageResourceType;
  page?: number;
  perPage?: number;
  modifiedAfter?: string;
  dateFrom?: string;
  dateTo?: string;
  resolveInternalId?: (payload: NormalizedCommercePayload) => string | undefined | Promise<string | undefined>;
}

export interface SyncWooCommercePageDeps {
  service: CommerceSyncService;
  client: WooCommerceClient;
}

export interface SyncWooCommercePageResult {
  runId: string;
  resourceType: WooCommerceSyncPageResourceType;
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
  processedCount: number;
  normalizedCount: number;
  mappedCount: number;
  failedCount: number;
  errors: string[];
}

type ResolvedSyncWooCommercePageInput = SyncWooCommercePageInput & {
  page: number;
  perPage: number;
};

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function externalIdFrom(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).id;
  if (value == null) return null;
  const id = String(value).trim();
  return id || null;
}

async function fetchPage(client: WooCommerceClient, input: ResolvedSyncWooCommercePageInput) {
  if (input.resourceType === "customer") return client.getCustomers(input.page, input.perPage, input.modifiedAfter);
  if (input.resourceType === "product") return client.getProducts(input.page, input.perPage, input.modifiedAfter);
  if (input.resourceType === "order") return client.getOrders(input.page, input.perPage, input.modifiedAfter, input.dateFrom, input.dateTo);
  return client.getCategories(input.page, input.perPage);
}

export async function syncWooCommercePage(
  ctx: TenantContext,
  input: SyncWooCommercePageInput,
  deps: SyncWooCommercePageDeps
): Promise<ModuleResult<SyncWooCommercePageResult>> {
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 50;
  const run = await deps.service.startSyncRun(ctx, input.connectionId, input.resourceType);
  if (!run.ok || !run.data) return fail(run.error?.code ?? "sync_run_start_failed", run.error?.message ?? "Could not start sync run.");

  const errors: string[] = [];
  let normalizedCount = 0;
  let mappedCount = 0;

  try {
    const response = await fetchPage(deps.client, { ...input, page, perPage });
    for (const payload of response.data) {
      const externalId = externalIdFrom(payload);
      if (!externalId) {
        errors.push(`${input.resourceType}: missing WooCommerce id`);
        continue;
      }

      const envelope = await deps.service.normalizeCommercePayload(ctx, {
        connectionId: input.connectionId,
        resourceType: input.resourceType,
        externalId,
        payload
      });
      if (!envelope.ok || !envelope.data) {
        errors.push(`${input.resourceType} ${externalId}: ${envelope.error?.message ?? "Could not normalize payload."}`);
        continue;
      }

      normalizedCount += 1;
      let internalId: string | undefined;
      try {
        internalId = await input.resolveInternalId?.(envelope.data.payload);
      } catch (error) {
        errors.push(`${input.resourceType} ${externalId}: ${error instanceof Error ? error.message : "Could not resolve internal id."}`);
        continue;
      }
      if (!internalId) continue;

      const mapping = await deps.service.recordProviderMapping(ctx, {
        connectionId: input.connectionId,
        resourceType: input.resourceType,
        externalId,
        internalId
      });
      if (mapping.ok) mappedCount += 1;
      else errors.push(`${input.resourceType} ${externalId}: ${mapping.error?.message ?? "Could not record provider mapping."}`);
    }

    const failedCount = errors.length;
    const completed = await deps.service.completeSyncRun(ctx, run.data.id, {
      processedCount: response.data.length,
      createdCount: normalizedCount,
      updatedCount: mappedCount,
      failedCount
    });
    if (!completed.ok) return fail(completed.error?.code ?? "sync_run_complete_failed", completed.error?.message ?? "Could not complete sync run.");

    return ok({
      runId: run.data.id,
      resourceType: input.resourceType,
      page,
      perPage,
      totalPages: response.totalPages,
      totalItems: response.totalItems,
      hasMore: page < response.totalPages || response.data.length >= perPage,
      processedCount: response.data.length,
      normalizedCount,
      mappedCount,
      failedCount,
      errors
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WooCommerce page sync failed.";
    await deps.service.failSyncRun(ctx, run.data.id, message);
    return fail("woocommerce_sync_failed", message);
  }
}
