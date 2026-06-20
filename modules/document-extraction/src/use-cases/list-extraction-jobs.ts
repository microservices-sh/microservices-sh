import { listExtractionJobsInputSchema, type ListExtractionJobsInput } from "../schemas";
import { fail, ok } from "../service";
import type { DocumentExtractionJob, DocumentExtractionStore, ModuleResult } from "../types";

export async function listExtractionJobs(
  input: ListExtractionJobsInput,
  deps: { store: DocumentExtractionStore }
): Promise<ModuleResult<{ jobs: DocumentExtractionJob[] }>> {
  const parsed = listExtractionJobsInputSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_EXTRACTION_JOB_FILTER", "Extraction job filter is invalid.", 400, parsed.error.issues);
  return ok(200, { jobs: await deps.store.listJobs(parsed.data) });
}
