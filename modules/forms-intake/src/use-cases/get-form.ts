import { getFormInputSchema } from "../schemas";
import type { FormStore } from "../ports";

// Fetch a single form, tenant-scoped (a tenant can never read another tenant's
// form even if it guesses the id).
export async function getForm(input: unknown, deps: { formStore: FormStore }) {
  const parsed = getFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_GET_INPUT", message: "Get input is invalid.", issues: parsed.error.issues }
    };
  }

  const form = await deps.formStore.getForm(parsed.data.formId, parsed.data.tenantId);
  if (!form) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "FORM_NOT_FOUND", message: "Form not found." } };
  }

  return { ok: true as const, status: 200 as const, data: { form } };
}
