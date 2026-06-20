import { defaultDocumentExtractionHooks, type DocumentExtractionHooks } from "../hooks";
import { submitExtractionDraftInputSchema, type SubmitExtractionDraftInput } from "../schemas";
import { fail, nowIso, ok } from "../service";
import type { DocumentExtractionJob, DocumentExtractionStore, ModuleResult } from "../types";

const CLOSED = new Set(["approved", "rejected"]);

export async function submitExtractionDraft(
  input: SubmitExtractionDraftInput,
  deps: { store: DocumentExtractionStore; hooks?: DocumentExtractionHooks }
): Promise<ModuleResult<{ job: DocumentExtractionJob }>> {
  const parsed = submitExtractionDraftInputSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_EXTRACTION_DRAFT", "Extraction draft is invalid.", 400, parsed.error.issues);

  const job = await deps.store.getJob({ jobId: parsed.data.jobId, tenantId: parsed.data.tenantId });
  if (!job) return fail("EXTRACTION_JOB_NOT_FOUND", "Extraction job was not found.", 404);
  if (CLOSED.has(job.status)) return fail("EXTRACTION_JOB_CLOSED", "Extraction job has already been reviewed.", 409);

  const hooks = { ...defaultDocumentExtractionHooks, ...deps.hooks };
  const draft = await hooks.beforeExtractionDraftSubmit({ job, draft: parsed.data.draft });
  if (!draft) return fail("EXTRACTION_DRAFT_REJECTED", "Extraction draft was rejected by beforeExtractionDraftSubmit.", 403);

  const updated = await deps.store.updateJob({
    jobId: job.id,
    tenantId: job.tenantId,
    patch: {
      status: "needs_review",
      selectedRuntime: draft.runtime,
      draft,
      error: null,
      updatedAt: nowIso()
    }
  });

  if (!updated) return fail("EXTRACTION_JOB_NOT_FOUND", "Extraction job was not found.", 404);
  return ok(200, { job: updated }, draft.warnings);
}
