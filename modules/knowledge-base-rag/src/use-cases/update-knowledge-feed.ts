import { err, ok } from "@microservices-sh/connection-contract";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { updateKnowledgeFeedInputSchema } from "../schemas";
import type { DomainEvent, KnowledgeFeed } from "../types";
import { isoFrom } from "./helpers";

export async function updateKnowledgeFeed(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = updateKnowledgeFeedInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_FEED_UPDATE", message: "Knowledge feed update is invalid.", issues: parsed.error.issues }, meta);
  }

  const existing = await deps.store.getKnowledgeFeed(parsed.data.id);
  if (!existing) {
    return err(404, { code: "knowledge-base-rag.FEED_NOT_FOUND", message: "Knowledge feed not found." }, meta);
  }

  const nowIso = isoFrom(deps.now);
  const syncStatus = parsed.data.syncStatus ?? existing.syncStatus;
  const feed: KnowledgeFeed = {
    ...existing,
    name: parsed.data.name ?? existing.name,
    sourceUrl: parsed.data.sourceUrl ?? existing.sourceUrl,
    config: parsed.data.config ?? existing.config,
    syncFrequency: parsed.data.syncFrequency ?? existing.syncFrequency,
    lastSyncedAt: syncStatus === "synced" ? nowIso : existing.lastSyncedAt,
    nextSyncAt: existing.nextSyncAt,
    syncStatus,
    syncError: syncStatus === "synced" ? null : parsed.data.syncError !== undefined ? parsed.data.syncError : existing.syncError,
    rowsTotal: parsed.data.rowsTotal ?? existing.rowsTotal,
    articlesCreated: parsed.data.articlesCreated ?? existing.articlesCreated,
    articlesUpdated: parsed.data.articlesUpdated ?? existing.articlesUpdated,
    articlesDeleted: parsed.data.articlesDeleted ?? existing.articlesDeleted,
    lastRowHash: parsed.data.lastRowHash !== undefined ? parsed.data.lastRowHash : existing.lastRowHash,
    isActive: parsed.data.isActive ?? existing.isActive,
    updatedAt: nowIso
  };

  await deps.store.updateKnowledgeFeed(feed);
  const event: DomainEvent = {
    name: "knowledge-base-rag.feed_updated",
    correlationId: meta.correlationId,
    payload: { id: feed.id, tenantId: feed.tenantId, syncStatus: feed.syncStatus, isActive: feed.isActive }
  };
  await deps.store.writeEvent(event);

  return ok(200, { feed, event }, meta);
}
