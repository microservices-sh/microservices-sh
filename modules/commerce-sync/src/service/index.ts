import type { CommerceSyncStore } from "../ports";
import type {
  CommerceConnection,
  CommerceProvider,
  CommerceResourceType,
  CommerceSyncIdGenerator,
  CommerceSyncMemoryService,
  CommerceSyncService,
  CompleteSyncRunInput,
  CreateCommerceConnectionInput,
  ModuleResult,
  NormalizedCommerceEnvelope,
  NormalizeCommercePayloadInput,
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
      if (!(await requireConnection(ctx, input.connectionId))) return fail("connection_not_found", "Commerce connection not found.");
      const envelope: NormalizedCommerceEnvelope = {
        id: idGenerator("csenv"),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        resourceType: input.resourceType,
        externalId: input.externalId,
        payload: input.payload,
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
      if (!requireConnection(ctx, input.connectionId)) return fail("connection_not_found", "Commerce connection not found.");
      const envelope: NormalizedCommerceEnvelope = {
        id: sequenceId("csenv", ++envelopeSequence),
        tenantId: ctx.tenantId,
        connectionId: input.connectionId,
        resourceType: input.resourceType,
        externalId: input.externalId,
        payload: input.payload,
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
