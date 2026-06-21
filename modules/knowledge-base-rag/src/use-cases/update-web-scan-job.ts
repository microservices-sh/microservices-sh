import { err, ok } from "@microservices-sh/connection-contract";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { updateWebScanJobInputSchema } from "../schemas";
import type { DomainEvent, WebScanJob } from "../types";
import { isoFrom } from "./helpers";

export async function updateWebScanJob(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = updateWebScanJobInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_WEB_SCAN_JOB_UPDATE", message: "Web scan job update is invalid.", issues: parsed.error.issues }, meta);
  }

  const existing = await deps.store.getWebScanJob(parsed.data.id);
  if (!existing) {
    return err(404, { code: "knowledge-base-rag.WEB_SCAN_JOB_NOT_FOUND", message: "Web scan job not found." }, meta);
  }

  const status = parsed.data.status ?? existing.status;
  const completedAt =
    status === "completed" || status === "failed"
      ? existing.completedAt ?? isoFrom(deps.now)
      : null;
  const job: WebScanJob = {
    ...existing,
    status,
    pagesScanned: parsed.data.pagesScanned ?? existing.pagesScanned,
    articlesCreated: parsed.data.articlesCreated ?? existing.articlesCreated,
    error: parsed.data.error !== undefined ? parsed.data.error : existing.error,
    completedAt
  };

  await deps.store.updateWebScanJob(job);
  const event: DomainEvent = {
    name: "knowledge-base-rag.web_scan_job_updated",
    correlationId: meta.correlationId,
    payload: { id: job.id, tenantId: job.tenantId, status: job.status, pagesScanned: job.pagesScanned, articlesCreated: job.articlesCreated }
  };
  await deps.store.writeEvent(event);

  return ok(200, { job, event }, meta);
}
