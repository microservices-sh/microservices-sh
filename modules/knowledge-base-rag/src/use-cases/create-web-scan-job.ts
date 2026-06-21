import { err, ok } from "@microservices-sh/connection-contract";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { createWebScanJobInputSchema } from "../schemas";
import type { DomainEvent, WebScanJob } from "../types";
import { generatedId, isoFrom } from "./helpers";

export async function createWebScanJob(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    id?: () => string;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = createWebScanJobInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_WEB_SCAN_JOB_INPUT", message: "Web scan job input is invalid.", issues: parsed.error.issues }, meta);
  }

  const nowIso = isoFrom(deps.now);
  const job: WebScanJob = {
    id: deps.id?.() ?? generatedId("kbw"),
    tenantId: parsed.data.tenantId,
    projectId: parsed.data.projectId ?? null,
    baseUrl: parsed.data.baseUrl,
    status: parsed.data.status,
    pagesScanned: 0,
    articlesCreated: 0,
    error: null,
    createdAt: nowIso,
    completedAt: parsed.data.status === "completed" || parsed.data.status === "failed" ? nowIso : null
  };

  await deps.store.insertWebScanJob(job);
  const event: DomainEvent = {
    name: "knowledge-base-rag.web_scan_job_created",
    correlationId: meta.correlationId,
    payload: { id: job.id, tenantId: job.tenantId, projectId: job.projectId, baseUrl: job.baseUrl, status: job.status }
  };
  await deps.store.writeEvent(event);

  return ok(201, { job, event }, meta);
}
