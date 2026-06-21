import type {
  CommerceConnection,
  CommerceProvider,
  CommerceResourceType,
  ModuleResult,
  NormalizedCommerceEnvelope,
  ProviderMapping,
  SyncRun,
  TenantContext,
  WebhookReceipt
} from "../types";

interface CreateConnectionInput {
  provider: CommerceProvider;
  name: string;
  baseUrl?: string;
  secretRef: string;
}

interface RecordMappingInput {
  connectionId: string;
  resourceType: CommerceResourceType;
  externalId: string;
  internalId: string;
}

interface CompleteSyncRunInput {
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
}

interface RecordWebhookInput {
  connectionId: string;
  topic: string;
  idempotencyKey: string;
  signature?: string;
  payload: unknown;
}

interface NormalizePayloadInput {
  connectionId: string;
  resourceType: CommerceResourceType;
  externalId: string;
  payload: unknown;
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

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createCommerceSyncMemoryService() {
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
    createCommerceConnection(ctx: TenantContext, input: CreateConnectionInput): ModuleResult<CommerceConnection> {
      if (!input.secretRef.trim()) return fail("secret_ref_required", "Provider credentials must be stored as an opaque secret reference.");
      const createdAt = now(ctx);
      const connection: CommerceConnection = {
        id: id("csconn", ++connectionSequence),
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

    recordProviderMapping(ctx: TenantContext, input: RecordMappingInput): ModuleResult<ProviderMapping> {
      const connection = requireConnection(ctx, input.connectionId);
      if (!connection) return fail("connection_not_found", "Commerce connection not found.");
      const key = `${ctx.tenantId}:${connection.provider}:${input.resourceType}:${input.externalId}`;
      const existing = mappingKeys.get(key);
      if (existing) return ok(mappings.get(existing)!);
      const createdAt = now(ctx);
      const mapping: ProviderMapping = {
        id: id("csmap", ++mappingSequence),
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
        id: id("csrun", ++runSequence),
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

    recordWebhookReceipt(ctx: TenantContext, input: RecordWebhookInput): ModuleResult<WebhookReceipt> {
      if (!requireConnection(ctx, input.connectionId)) return fail("connection_not_found", "Commerce connection not found.");
      const key = `${ctx.tenantId}:${input.connectionId}:${input.idempotencyKey}`;
      const existing = receiptKeys.get(key);
      if (existing) return ok({ ...receipts.get(existing)!, replayed: true });
      const receipt: WebhookReceipt = {
        id: id("cswh", ++receiptSequence),
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

    normalizeCommercePayload(ctx: TenantContext, input: NormalizePayloadInput): ModuleResult<NormalizedCommerceEnvelope> {
      if (!requireConnection(ctx, input.connectionId)) return fail("connection_not_found", "Commerce connection not found.");
      const envelope: NormalizedCommerceEnvelope = {
        id: id("csenv", ++envelopeSequence),
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
