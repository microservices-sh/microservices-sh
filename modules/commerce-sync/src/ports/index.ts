import type {
  CommerceConnection,
  CommerceProvider,
  CommerceResourceType,
  NormalizedCommerceEnvelope,
  ProviderMapping,
  SyncRun,
  WebhookReceipt
} from "../types";

export interface CommerceSyncStore {
  insertConnection(connection: CommerceConnection): Promise<void>;
  getConnection(tenantId: string, connectionId: string): Promise<CommerceConnection | null>;
  listConnections(tenantId: string): Promise<CommerceConnection[]>;
  findMappingByExternal(
    tenantId: string,
    provider: CommerceProvider,
    resourceType: CommerceResourceType,
    externalId: string
  ): Promise<ProviderMapping | null>;
  insertMapping(mapping: ProviderMapping): Promise<void>;
  insertSyncRun(run: SyncRun): Promise<void>;
  getSyncRun(tenantId: string, runId: string): Promise<SyncRun | null>;
  updateSyncRun(run: SyncRun): Promise<void>;
  findWebhookReceiptByIdempotency(
    tenantId: string,
    connectionId: string,
    idempotencyKey: string
  ): Promise<WebhookReceipt | null>;
  insertWebhookReceipt(receipt: WebhookReceipt): Promise<void>;
  insertEnvelope(envelope: NormalizedCommerceEnvelope): Promise<void>;
}

/**
 * @deprecated Use CommerceSyncStore. The repository name remains as an alias
 * for early draft consumers that imported the placeholder port.
 */
export type CommerceSyncRepository = CommerceSyncStore;
