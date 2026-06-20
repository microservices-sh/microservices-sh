import { getExtractionJobInputSchema, type GetExtractionJobInput } from "../schemas";
import { fail, ok } from "../service";
import type { DocumentExtractionJob, DocumentExtractionStore, ModuleResult } from "../types";

export async function getExtractionJob(
  input: GetExtractionJobInput,
  deps: { store: DocumentExtractionStore }
): Promise<ModuleResult<{ job: DocumentExtractionJob }>> {
  const parsed = getExtractionJobInputSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_EXTRACTION_JOB_LOOKUP", "Extraction job lookup is invalid.", 400, parsed.error.issues);

  const job = await deps.store.getJob(parsed.data);
  if (!job) return fail("EXTRACTION_JOB_NOT_FOUND", "Extraction job was not found.", 404);
  return ok(200, { job });
}
