import { ok, err } from "@microservices-sh/connection-contract";
import { formsIntakeMeta } from "../meta";
import { getFormInputSchema } from "../schemas";
import type { FormStore } from "../ports";

// Fetch a single form, tenant-scoped (a tenant can never read another tenant's
// form even if it guesses the id).
export async function getForm(
  input: unknown,
  deps: { formStore: FormStore; now?: () => number; correlationId?: string }
) {
  const meta = formsIntakeMeta(deps);

  const parsed = getFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "forms-intake.INVALID_GET_INPUT", message: "Get input is invalid.", issues: parsed.error.issues }, meta);
  }

  const form = await deps.formStore.getForm(parsed.data.formId, parsed.data.tenantId);
  if (!form) {
    return err(404, { code: "forms-intake.FORM_NOT_FOUND", message: "Form not found." }, meta);
  }

  return ok(200, { form }, meta);
}
