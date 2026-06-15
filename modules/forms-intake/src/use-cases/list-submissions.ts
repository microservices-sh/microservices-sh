import { ok, err } from "@microservices-sh/connection-contract";
import { formsIntakeMeta } from "../meta";
import { listSubmissionsFilterSchema } from "../schemas";
import type { FormStore } from "../ports";

// Tenant + form scoped listing of submissions. Both scopes are required so one
// tenant can never read another's intake data by guessing a form id.
export async function listSubmissions(
  input: unknown,
  deps: { formStore: FormStore; now?: () => number; correlationId?: string }
) {
  const meta = formsIntakeMeta(deps);

  const parsed = listSubmissionsFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "forms-intake.INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }, meta);
  }
  const submissions = await deps.formStore.listSubmissions(parsed.data);
  return ok(200, { submissions, count: submissions.length }, meta);
}
