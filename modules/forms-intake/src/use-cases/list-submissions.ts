import { listSubmissionsFilterSchema } from "../schemas";
import type { FormStore } from "../ports";

// Tenant + form scoped listing of submissions. Both scopes are required so one
// tenant can never read another's intake data by guessing a form id.
export async function listSubmissions(input: unknown, deps: { formStore: FormStore }) {
  const parsed = listSubmissionsFilterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }
    };
  }
  const submissions = await deps.formStore.listSubmissions(parsed.data);
  return { ok: true as const, status: 200 as const, data: { submissions, count: submissions.length } };
}
