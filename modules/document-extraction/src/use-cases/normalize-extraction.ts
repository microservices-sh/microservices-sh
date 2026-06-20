import { normalizeExtractionInputSchema, type NormalizeExtractionInput } from "../schemas";
import { fail, ok } from "../service";
import type { ExtractionDraft, ExtractionNormalizer, ModuleResult } from "../types";

export async function normalizeExtraction(
  input: NormalizeExtractionInput,
  deps: { normalizer: ExtractionNormalizer }
): Promise<ModuleResult<{ draft: ExtractionDraft }>> {
  const parsed = normalizeExtractionInputSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_NORMALIZATION_INPUT", "Extraction normalization input is invalid.", 400, parsed.error.issues);
  return ok(200, { draft: await deps.normalizer.normalize(parsed.data) });
}
