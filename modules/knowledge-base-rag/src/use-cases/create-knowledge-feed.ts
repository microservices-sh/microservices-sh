import { err, ok } from "@microservices-sh/connection-contract";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { createKnowledgeFeedInputSchema } from "../schemas";
import type { DomainEvent, KnowledgeFeed } from "../types";
import { generatedId, isoFrom } from "./helpers";

export async function createKnowledgeFeed(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    id?: () => string;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = createKnowledgeFeedInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_FEED_INPUT", message: "Knowledge feed input is invalid.", issues: parsed.error.issues }, meta);
  }

  const nowIso = isoFrom(deps.now);
  const feed: KnowledgeFeed = {
    id: deps.id?.() ?? generatedId("kbfed"),
    tenantId: parsed.data.tenantId,
    projectId: parsed.data.projectId ?? null,
    feedType: parsed.data.feedType,
    name: parsed.data.name,
    sourceUrl: parsed.data.sourceUrl,
    config: parsed.data.config,
    syncFrequency: parsed.data.syncFrequency,
    lastSyncedAt: null,
    nextSyncAt: null,
    syncStatus: "pending",
    syncError: null,
    rowsTotal: 0,
    articlesCreated: 0,
    articlesUpdated: 0,
    articlesDeleted: 0,
    lastRowHash: null,
    isActive: parsed.data.isActive,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await deps.store.insertKnowledgeFeed(feed);
  const event: DomainEvent = {
    name: "knowledge-base-rag.feed_created",
    correlationId: meta.correlationId,
    payload: { id: feed.id, tenantId: feed.tenantId, projectId: feed.projectId, feedType: feed.feedType, syncFrequency: feed.syncFrequency }
  };
  await deps.store.writeEvent(event);

  return ok(201, { feed, event }, meta);
}
