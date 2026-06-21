import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const LIMIT = 50;

const runTone = (status: string, failedCount: number): Tone =>
  status === "failed" || failedCount > 0 ? "bad" : status === "completed" ? "good" : "warn";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("commerce-sync", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = locals.commerceSyncService;
  const ctx = { tenantId: activeOrgId };
  const [connectionsResult, runsResult, mappingsResult, receiptsResult] = await Promise.all([
    service.listCommerceConnections(ctx),
    service.listSyncRuns(ctx),
    service.listProviderMappings(ctx),
    service.listWebhookReceipts(ctx)
  ]);
  const connections = connectionsResult.ok && connectionsResult.data ? connectionsResult.data : [];
  const connectionsById = new Map(connections.map((connection) => [connection.id, connection]));
  const now = Date.now();

  return {
    connections: connections.slice(0, LIMIT).map((connection) => ({
      id: connection.id,
      name: connection.name,
      provider: connection.provider,
      baseUrl: connection.baseUrl ?? null,
      active: connection.active,
      created: relativeTime(connection.createdAt, now)
    })),
    runs: (runsResult.ok && runsResult.data ? runsResult.data : []).slice(0, LIMIT).map((run) => {
      const connection = connectionsById.get(run.connectionId);
      return {
        id: run.id,
        connectionId: run.connectionId,
        connectionName: connection?.name ?? run.connectionId,
        provider: connection?.provider ?? "custom",
        resourceType: run.resourceType,
        status: run.status,
        tone: runTone(run.status, run.failedCount),
        started: relativeTime(run.startedAt, now),
        completed: run.completedAt ? relativeTime(run.completedAt, now) : null,
        processedCount: run.processedCount,
        createdCount: run.createdCount,
        updatedCount: run.updatedCount,
        failedCount: run.failedCount,
        hasError: Boolean(run.errorMessage)
      };
    }),
    receipts: (receiptsResult.ok && receiptsResult.data ? receiptsResult.data : []).slice(0, LIMIT).map((receipt) => {
      const connection = connectionsById.get(receipt.connectionId);
      return {
        id: receipt.id,
        connectionId: receipt.connectionId,
        connectionName: connection?.name ?? receipt.connectionId,
        provider: connection?.provider ?? "custom",
        topic: receipt.topic,
        idempotencyKey: receipt.idempotencyKey,
        replayed: receipt.replayed,
        received: relativeTime(receipt.receivedAt, now)
      };
    }),
    mappings: (mappingsResult.ok && mappingsResult.data ? mappingsResult.data : []).slice(0, LIMIT).map((mapping) => {
      const connection = connectionsById.get(mapping.connectionId);
      return {
        id: mapping.id,
        connectionId: mapping.connectionId,
        connectionName: connection?.name ?? mapping.connectionId,
        provider: mapping.provider,
        resourceType: mapping.resourceType,
        externalId: mapping.externalId,
        internalId: mapping.internalId,
        created: relativeTime(mapping.createdAt, now)
      };
    })
  };
};
