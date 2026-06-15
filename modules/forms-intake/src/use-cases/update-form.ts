import { ok, err } from "@microservices-sh/connection-contract";
import { formsIntakeMeta } from "../meta";
import { updateFormInputSchema } from "../schemas";
import type { FormStore } from "../ports";
import type { FormField } from "../types";

// Update a form — DRAFT ONLY. A published form's field set is frozen so historical
// submissions stay interpretable against the definition they were validated with.
// Editing fields on a published form is the bug that silently invalidates past
// data; this use case refuses it.
export async function updateForm(
  input: unknown,
  deps: { formStore: FormStore; now?: () => number; correlationId?: string }
) {
  const meta = formsIntakeMeta(deps);

  const parsed = updateFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "forms-intake.INVALID_UPDATE_INPUT", message: "Update input is invalid.", issues: parsed.error.issues }, meta);
  }

  const form = await deps.formStore.getForm(parsed.data.formId, parsed.data.tenantId);
  if (!form) {
    return err(404, { code: "forms-intake.FORM_NOT_FOUND", message: "Form not found." }, meta);
  }
  if (form.status !== "draft") {
    return err(409, { code: "forms-intake.FORM_NOT_EDITABLE", message: "Only draft forms can be edited; the field set is frozen once published." }, meta);
  }

  if (parsed.data.fields) {
    const ids = parsed.data.fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length) {
      return err(422, { code: "forms-intake.DUPLICATE_FIELD_ID", message: "Field ids must be unique within a form." }, meta);
    }
    form.fields = parsed.data.fields as FormField[];
  }
  if (parsed.data.name !== undefined) form.name = parsed.data.name;
  if (parsed.data.requireTurnstile !== undefined) form.requireTurnstile = parsed.data.requireTurnstile;

  form.version += 1;
  form.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.formStore.updateForm(form);

  const event = {
    name: "forms-intake.form_updated",
    correlationId: meta.correlationId,
    payload: { id: form.id, tenantId: form.tenantId, version: form.version }
  };

  return ok(200, { id: form.id, status: form.status, version: form.version, event }, meta);
}
