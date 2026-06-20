import { defaultDocumentExtractionHooks, type DocumentExtractionHooks } from "../hooks";
import { createExtractionJobInputSchema, type CreateExtractionJobInput } from "../schemas";
import { createId, fail, nowIso, ok } from "../service";
import type { DocumentExtractionJob, DocumentExtractionStore, ModuleResult } from "../types";

export async function createExtractionJob(
  input: CreateExtractionJobInput,
  deps: { store: DocumentExtractionStore; hooks?: DocumentExtractionHooks }
): Promise<ModuleResult<{ job: DocumentExtractionJob }>> {
  const parsed = createExtractionJobInputSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_EXTRACTION_JOB", "Extraction job input is invalid.", 400, parsed.error.issues);

  const hooks = { ...defaultDocumentExtractionHooks, ...deps.hooks };
  const hooked = await hooks.beforeExtractionJobCreate(parsed.data);
  if (!hooked) return fail("EXTRACTION_JOB_REJECTED", "Extraction job was rejected by beforeExtractionJobCreate.", 403);
  const normalized = createExtractionJobInputSchema.parse(hooked);

  const at = nowIso();
  const job: DocumentExtractionJob = {
    id: createId("dex"),
    tenantId: normalized.tenantId,
    ownerId: normalized.ownerId ?? null,
    status: "pending",
    targetType: normalized.targetType,
    schemaId: normalized.schemaId,
    requestedMode: normalized.requestedMode,
    selectedRuntime: null,
    source: normalized.source,
    draft: null,
    approvedOutput: null,
    review: null,
    metadata: normalized.metadata,
    error: null,
    createdAt: at,
    updatedAt: at
  };

  return ok(201, { job: await deps.store.createJob(job) });
}
