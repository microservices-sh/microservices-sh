import { err, ok } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { listWebScanJobsInputSchema } from "../schemas";

export async function listWebScanJobs(
  input: unknown,
  deps: { store: KnowledgeStore; config?: Partial<typeof defaultConfig>; correlationId?: string; now?: () => number }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = listWebScanJobsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_WEB_SCAN_JOB_FILTER", message: "Web scan job filter is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const jobs = await deps.store.listWebScanJobs({
    ...parsed.data,
    limit: Math.min(parsed.data.limit ?? cfg.defaultSearchLimit, cfg.maxSearchLimit)
  });

  return ok(200, { jobs, count: jobs.length }, meta);
}
