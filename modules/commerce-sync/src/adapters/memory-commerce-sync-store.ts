import type { CommerceSyncStore } from "../ports";
import type {
  CommerceConnection,
  CommerceProvider,
  CommerceResourceType,
  NormalizedCommerceEnvelope,
  ProviderMapping,
  SyncRun,
  WebhookReceipt
} from "../types";

function mappingKey(
  tenantId: string,
  provider: CommerceProvider,
  resourceType: CommerceResourceType,
  externalId: string
): string {
  return [tenantId, provider, resourceType, externalId].join("\u0000");
}

function receiptKey(tenantId: string, connectionId: string, idempotencyKey: string): string {
  return [tenantId, connectionId, idempotencyKey].join("\u0000");
}

function cloneConnection(connection: CommerceConnection): CommerceConnection {
  return { ...connection };
}

function cloneMapping(mapping: ProviderMapping): ProviderMapping {
  return { ...mapping };
}

function cloneRun(run: SyncRun): SyncRun {
  return { ...run };
}

function cloneReceipt(receipt: WebhookReceipt): WebhookReceipt {
  return { ...receipt };
}

function cloneEnvelope(envelope: NormalizedCommerceEnvelope): NormalizedCommerceEnvelope {
  return { ...envelope };
}

export function createMemoryCommerceSyncStore(): CommerceSyncStore {
  const connections = new Map<string, CommerceConnection>();
  const mappings = new Map<string, ProviderMapping>();
  const mappingKeys = new Map<string, string>();
  const runs = new Map<string, SyncRun>();
  const receipts = new Map<string, WebhookReceipt>();
  const receiptKeys = new Map<string, string>();
  const envelopes = new Map<string, NormalizedCommerceEnvelope>();

  return {
    async insertConnection(connection) {
      connections.set(connection.id, cloneConnection(connection));
    },

    async getConnection(tenantId, connectionId) {
      const connection = connections.get(connectionId);
      return connection && connection.tenantId === tenantId ? cloneConnection(connection) : null;
    },

    async listConnections(tenantId) {
      return [...connections.values()]
        .filter((connection) => connection.tenantId === tenantId)
        .map(cloneConnection);
    },

    async findMappingByExternal(tenantId, provider, resourceType, externalId) {
      const id = mappingKeys.get(mappingKey(tenantId, provider, resourceType, externalId));
      const mapping = id ? mappings.get(id) : null;
      return mapping ? cloneMapping(mapping) : null;
    },

    async insertMapping(mapping) {
      const key = mappingKey(mapping.tenantId, mapping.provider, mapping.resourceType, mapping.externalId);
      if (mappingKeys.has(key)) {
        throw new Error(
          "UNIQUE constraint failed: commerce_sync_mappings.tenant_id, commerce_sync_mappings.provider, commerce_sync_mappings.resource_type, commerce_sync_mappings.external_id"
        );
      }
      mappings.set(mapping.id, cloneMapping(mapping));
      mappingKeys.set(key, mapping.id);
    },

    async listMappings(tenantId) {
      return [...mappings.values()]
        .filter((mapping) => mapping.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(cloneMapping);
    },

    async insertSyncRun(run) {
      runs.set(run.id, cloneRun(run));
    },

    async getSyncRun(tenantId, runId) {
      const run = runs.get(runId);
      return run && run.tenantId === tenantId ? cloneRun(run) : null;
    },

    async updateSyncRun(run) {
      runs.set(run.id, cloneRun(run));
    },

    async listSyncRuns(tenantId) {
      return [...runs.values()]
        .filter((run) => run.tenantId === tenantId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map(cloneRun);
    },

    async findWebhookReceiptByIdempotency(tenantId, connectionId, idempotencyKey) {
      const id = receiptKeys.get(receiptKey(tenantId, connectionId, idempotencyKey));
      const receipt = id ? receipts.get(id) : null;
      return receipt ? cloneReceipt(receipt) : null;
    },

    async insertWebhookReceipt(receipt) {
      const key = receiptKey(receipt.tenantId, receipt.connectionId, receipt.idempotencyKey);
      if (receiptKeys.has(key)) {
        throw new Error(
          "UNIQUE constraint failed: commerce_sync_webhook_receipts.tenant_id, commerce_sync_webhook_receipts.connection_id, commerce_sync_webhook_receipts.idempotency_key"
        );
      }
      receipts.set(receipt.id, cloneReceipt(receipt));
      receiptKeys.set(key, receipt.id);
    },

    async listWebhookReceipts(tenantId) {
      return [...receipts.values()]
        .filter((receipt) => receipt.tenantId === tenantId)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .map(cloneReceipt);
    },

    async insertEnvelope(envelope) {
      envelopes.set(envelope.id, cloneEnvelope(envelope));
    }
  };
}
