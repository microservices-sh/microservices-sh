import type { CommerceSyncStore } from "../ports";
import type {
  CommerceConnection,
  CommerceProvider,
  CommerceResourceType,
  NormalizedCommerceEnvelope,
  ProviderMapping,
  SyncRun,
  SyncRunStatus,
  WebhookReceipt
} from "../types";

const CONNECTION_COLUMNS = "id, tenant_id, provider, name, base_url, secret_ref, active, created_at, updated_at";
const MAPPING_COLUMNS = "id, tenant_id, connection_id, provider, resource_type, external_id, internal_id, created_at, updated_at";
const RUN_COLUMNS =
  "id, tenant_id, connection_id, resource_type, status, started_at, completed_at, processed_count, created_count, updated_count, failed_count, error_message";
const WEBHOOK_COLUMNS = "id, tenant_id, connection_id, topic, idempotency_key, signature, payload, received_at";
const ENVELOPE_COLUMNS = "id, tenant_id, connection_id, resource_type, external_id, payload, received_at";

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function rowToConnection(row: Record<string, unknown>): CommerceConnection {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    provider: String(row.provider) as CommerceProvider,
    name: String(row.name),
    baseUrl: row.base_url == null ? undefined : String(row.base_url),
    secretRef: String(row.secret_ref),
    active: Number(row.active ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToMapping(row: Record<string, unknown>): ProviderMapping {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    connectionId: String(row.connection_id),
    provider: String(row.provider) as CommerceProvider,
    resourceType: String(row.resource_type) as CommerceResourceType,
    externalId: String(row.external_id),
    internalId: String(row.internal_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToSyncRun(row: Record<string, unknown>): SyncRun {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    connectionId: String(row.connection_id),
    resourceType: String(row.resource_type) as CommerceResourceType,
    status: String(row.status) as SyncRunStatus,
    startedAt: String(row.started_at),
    completedAt: row.completed_at == null ? undefined : String(row.completed_at),
    processedCount: Number(row.processed_count ?? 0),
    createdCount: Number(row.created_count ?? 0),
    updatedCount: Number(row.updated_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    errorMessage: row.error_message == null ? undefined : String(row.error_message)
  };
}

function rowToWebhookReceipt(row: Record<string, unknown>): WebhookReceipt {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    connectionId: String(row.connection_id),
    topic: String(row.topic),
    idempotencyKey: String(row.idempotency_key),
    signature: row.signature == null ? undefined : String(row.signature),
    payload: parseJson(row.payload),
    replayed: false,
    receivedAt: String(row.received_at)
  };
}

function rowToEnvelope(row: Record<string, unknown>): NormalizedCommerceEnvelope {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    connectionId: String(row.connection_id),
    resourceType: String(row.resource_type) as CommerceResourceType,
    externalId: String(row.external_id),
    payload: parseJson(row.payload),
    receivedAt: String(row.received_at)
  };
}

export function createD1CommerceSyncStore(db: D1Database): CommerceSyncStore {
  return {
    async insertConnection(connection) {
      await db
        .prepare(`INSERT INTO commerce_sync_connections (${CONNECTION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          connection.id,
          connection.tenantId,
          connection.provider,
          connection.name,
          connection.baseUrl ?? null,
          connection.secretRef,
          connection.active ? 1 : 0,
          connection.createdAt,
          connection.updatedAt
        )
        .run();
    },

    async getConnection(tenantId, connectionId) {
      const row = await db
        .prepare(`SELECT ${CONNECTION_COLUMNS} FROM commerce_sync_connections WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, connectionId)
        .first<Record<string, unknown>>();
      return row ? rowToConnection(row) : null;
    },

    async listConnections(tenantId) {
      const result = await db
        .prepare(`SELECT ${CONNECTION_COLUMNS} FROM commerce_sync_connections WHERE tenant_id = ? ORDER BY created_at ASC, id ASC`)
        .bind(tenantId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToConnection);
    },

    async findMappingByExternal(tenantId, provider, resourceType, externalId) {
      const row = await db
        .prepare(
          `SELECT ${MAPPING_COLUMNS} FROM commerce_sync_mappings
           WHERE tenant_id = ? AND provider = ? AND resource_type = ? AND external_id = ?`
        )
        .bind(tenantId, provider, resourceType, externalId)
        .first<Record<string, unknown>>();
      return row ? rowToMapping(row) : null;
    },

    async insertMapping(mapping) {
      await db
        .prepare(`INSERT INTO commerce_sync_mappings (${MAPPING_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          mapping.id,
          mapping.tenantId,
          mapping.connectionId,
          mapping.provider,
          mapping.resourceType,
          mapping.externalId,
          mapping.internalId,
          mapping.createdAt,
          mapping.updatedAt
        )
        .run();
    },

    async listMappings(tenantId) {
      const result = await db
        .prepare(`SELECT ${MAPPING_COLUMNS} FROM commerce_sync_mappings WHERE tenant_id = ? ORDER BY created_at DESC, id DESC`)
        .bind(tenantId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToMapping);
    },

    async insertSyncRun(run) {
      await db
        .prepare(`INSERT INTO commerce_sync_runs (${RUN_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          run.id,
          run.tenantId,
          run.connectionId,
          run.resourceType,
          run.status,
          run.startedAt,
          run.completedAt ?? null,
          run.processedCount,
          run.createdCount,
          run.updatedCount,
          run.failedCount,
          run.errorMessage ?? null
        )
        .run();
    },

    async getSyncRun(tenantId, runId) {
      const row = await db
        .prepare(`SELECT ${RUN_COLUMNS} FROM commerce_sync_runs WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, runId)
        .first<Record<string, unknown>>();
      return row ? rowToSyncRun(row) : null;
    },

    async updateSyncRun(run) {
      await db
        .prepare(
          `UPDATE commerce_sync_runs
           SET status = ?, completed_at = ?, processed_count = ?, created_count = ?, updated_count = ?, failed_count = ?, error_message = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          run.status,
          run.completedAt ?? null,
          run.processedCount,
          run.createdCount,
          run.updatedCount,
          run.failedCount,
          run.errorMessage ?? null,
          run.tenantId,
          run.id
        )
        .run();
    },

    async listSyncRuns(tenantId) {
      const result = await db
        .prepare(`SELECT ${RUN_COLUMNS} FROM commerce_sync_runs WHERE tenant_id = ? ORDER BY started_at DESC, id DESC`)
        .bind(tenantId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToSyncRun);
    },

    async findWebhookReceiptByIdempotency(tenantId, connectionId, idempotencyKey) {
      const row = await db
        .prepare(
          `SELECT ${WEBHOOK_COLUMNS} FROM commerce_sync_webhook_receipts
           WHERE tenant_id = ? AND connection_id = ? AND idempotency_key = ?`
        )
        .bind(tenantId, connectionId, idempotencyKey)
        .first<Record<string, unknown>>();
      return row ? rowToWebhookReceipt(row) : null;
    },

    async insertWebhookReceipt(receipt) {
      await db
        .prepare(`INSERT INTO commerce_sync_webhook_receipts (${WEBHOOK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          receipt.id,
          receipt.tenantId,
          receipt.connectionId,
          receipt.topic,
          receipt.idempotencyKey,
          receipt.signature ?? null,
          JSON.stringify(receipt.payload ?? {}),
          receipt.receivedAt
        )
        .run();
    },

    async listWebhookReceipts(tenantId) {
      const result = await db
        .prepare(`SELECT ${WEBHOOK_COLUMNS} FROM commerce_sync_webhook_receipts WHERE tenant_id = ? ORDER BY received_at DESC, id DESC`)
        .bind(tenantId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToWebhookReceipt);
    },

    async insertEnvelope(envelope) {
      await db
        .prepare(`INSERT INTO commerce_sync_envelopes (${ENVELOPE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          envelope.id,
          envelope.tenantId,
          envelope.connectionId,
          envelope.resourceType,
          envelope.externalId,
          JSON.stringify(envelope.payload ?? {}),
          envelope.receivedAt
        )
        .run();
    }
  };
}
