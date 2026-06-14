import { defaultConfig } from "../config";
import { createFormInputSchema } from "../schemas";
import type { FormStore } from "../ports";
import type { Form, FormField } from "../types";

// Create a draft form. The field set is stored as serializable data (round-trips
// through JSON in D1) so the same definition drives validation later — there is no
// second, drifting copy of the rules in route code.
export async function createForm(
  input: unknown,
  deps: { formStore: FormStore; now?: () => number; config?: Partial<typeof defaultConfig> }
) {
  const parsed = createFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_FORM_INPUT", message: "Form input is invalid.", issues: parsed.error.issues }
    };
  }

  // Field ids must be unique within a form — otherwise conditional logic and value
  // keying are ambiguous.
  const ids = parsed.data.fields.map((f) => f.id);
  if (new Set(ids).size !== ids.length) {
    return {
      ok: false as const,
      status: 422 as const,
      data: null,
      error: { code: "DUPLICATE_FIELD_ID", message: "Field ids must be unique within a form." }
    };
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const id = "form_" + crypto.randomUUID().slice(0, 16);

  const form: Form = {
    id,
    tenantId: parsed.data.tenantId,
    name: parsed.data.name,
    status: "draft",
    fields: parsed.data.fields as FormField[],
    requireTurnstile: parsed.data.requireTurnstile ?? cfg.defaultRequireTurnstile,
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await deps.formStore.insertForm(form);

  return { ok: true as const, status: 201 as const, data: { id, status: form.status, version: form.version } };
}
