import { updateFormInputSchema } from "../schemas";
import type { FormStore } from "../ports";
import type { FormField } from "../types";

// Update a form — DRAFT ONLY. A published form's field set is frozen so historical
// submissions stay interpretable against the definition they were validated with.
// Editing fields on a published form is the bug that silently invalidates past
// data; this use case refuses it.
export async function updateForm(
  input: unknown,
  deps: { formStore: FormStore; now?: () => number }
) {
  const parsed = updateFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_UPDATE_INPUT", message: "Update input is invalid.", issues: parsed.error.issues }
    };
  }

  const form = await deps.formStore.getForm(parsed.data.formId, parsed.data.tenantId);
  if (!form) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "FORM_NOT_FOUND", message: "Form not found." } };
  }
  if (form.status !== "draft") {
    return {
      ok: false as const,
      status: 409 as const,
      data: null,
      error: { code: "FORM_NOT_EDITABLE", message: "Only draft forms can be edited; the field set is frozen once published." }
    };
  }

  if (parsed.data.fields) {
    const ids = parsed.data.fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length) {
      return {
        ok: false as const,
        status: 422 as const,
        data: null,
        error: { code: "DUPLICATE_FIELD_ID", message: "Field ids must be unique within a form." }
      };
    }
    form.fields = parsed.data.fields as FormField[];
  }
  if (parsed.data.name !== undefined) form.name = parsed.data.name;
  if (parsed.data.requireTurnstile !== undefined) form.requireTurnstile = parsed.data.requireTurnstile;

  form.version += 1;
  form.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.formStore.updateForm(form);

  return { ok: true as const, status: 200 as const, data: { id: form.id, status: form.status, version: form.version } };
}
