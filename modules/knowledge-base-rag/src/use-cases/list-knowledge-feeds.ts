import { err, ok } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { listKnowledgeFeedsInputSchema } from "../schemas";

export async function listKnowledgeFeeds(
  input: unknown,
  deps: { store: KnowledgeStore; config?: Partial<typeof defaultConfig>; correlationId?: string; now?: () => number }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = listKnowledgeFeedsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_FEED_FILTER", message: "Knowledge feed filter is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const feeds = await deps.store.listKnowledgeFeeds({
    ...parsed.data,
    limit: Math.min(parsed.data.limit ?? cfg.defaultSearchLimit, cfg.maxSearchLimit)
  });

  return ok(200, { feeds, count: feeds.length }, meta);
}
