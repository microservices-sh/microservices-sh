import { err, ok } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { listSourcesInputSchema } from "../schemas";

export async function listSources(
  input: unknown,
  deps: { store: KnowledgeStore; config?: Partial<typeof defaultConfig>; correlationId?: string; now?: () => number }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = listSourcesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_SOURCE_FILTER", message: "Source list input is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const sources = await deps.store.listSources({
    ...parsed.data,
    limit: Math.min(parsed.data.limit ?? cfg.defaultSearchLimit, cfg.maxSearchLimit)
  });

  return ok(200, { sources, count: sources.length }, meta);
}
