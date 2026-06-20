import { defaultDocumentExtractionHooks, type DocumentExtractionHooks } from "../hooks";
import { reviewExtractionInputSchema, type ReviewExtractionInput } from "../schemas";
import { fail, nowIso, ok } from "../service";
import type { DocumentExtractionJob, DocumentExtractionStore, ModuleResult } from "../types";

export async function reviewExtraction(
  input: ReviewExtractionInput,
  deps: { store: DocumentExtractionStore; hooks?: DocumentExtractionHooks }
): Promise<ModuleResult<{ job: DocumentExtractionJob }>> {
  const parsed = reviewExtractionInputSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_EXTRACTION_REVIEW", "Extraction review input is invalid.", 400, parsed.error.issues);

  const job = await deps.store.getJob({ jobId: parsed.data.jobId, tenantId: parsed.data.tenantId });
  if (!job) return fail("EXTRACTION_JOB_NOT_FOUND", "Extraction job was not found.", 404);
  if (!job.draft) return fail("EXTRACTION_DRAFT_REQUIRED", "Submit an extraction draft before review.", 409);
  if (job.status === "approved" || job.status === "rejected") return fail("EXTRACTION_JOB_CLOSED", "Extraction job has already been reviewed.", 409);

  const at = nowIso();
  const approved = parsed.data.decision === "approve";
  const approvedOutput = approved ? parsed.data.approvedOutput ?? Object.fromEntries(job.draft.fields.map((field) => [field.name, field.value])) : null;
  const updated = await deps.store.updateJob({
    jobId: job.id,
    tenantId: job.tenantId,
    patch: {
      status: approved ? "approved" : "rejected",
      approvedOutput,
      review: {
        decision: parsed.data.decision,
        reviewerId: parsed.data.reviewerId,
        notes: parsed.data.notes,
        targetRecord: parsed.data.targetRecord,
        reviewedAt: at
      },
      updatedAt: at
    }
  });

  if (!updated) return fail("EXTRACTION_JOB_NOT_FOUND", "Extraction job was not found.", 404);
  const hooks = { ...defaultDocumentExtractionHooks, ...deps.hooks };
  await hooks.afterExtractionReviewed(updated);
  return ok(200, { job: updated });
}
