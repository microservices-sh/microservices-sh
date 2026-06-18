import { ok, err } from "@microservices-sh/connection-contract";
import { formsIntakeMeta } from "../meta";
import { listFormsFilterSchema } from "../schemas";
import type { FormStore } from "../ports";

// Tenant-scoped listing of forms. tenantId is required by the schema so one
// tenant can never enumerate another's forms.
export async function listForms(
  input: unknown,
  deps: { formStore: FormStore; now?: () => number; correlationId?: string }
) {
  const meta = formsIntakeMeta(deps);

  const parsed = listFormsFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "forms-intake.INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }, meta);
  }
  const forms = await deps.formStore.listForms(parsed.data);
  return ok(200, { forms, count: forms.length }, meta);
}
