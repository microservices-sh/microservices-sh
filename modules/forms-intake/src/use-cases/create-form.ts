import { ok, err } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { formsIntakeMeta } from "../meta";
import { createFormInputSchema } from "../schemas";
import type { FormStore } from "../ports";
import type { Form, FormField } from "../types";

// Create a draft form. The field set is stored as serializable data (round-trips
// through JSON in D1) so the same definition drives validation later — there is no
// second, drifting copy of the rules in route code.
export async function createForm(
  input: unknown,
  deps: {
    formStore: FormStore;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
    correlationId?: string;
  }
) {
  const meta = formsIntakeMeta(deps);

  const parsed = createFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "forms-intake.INVALID_FORM_INPUT", message: "Form input is invalid.", issues: parsed.error.issues }, meta);
  }

  // Field ids must be unique within a form — otherwise conditional logic and value
  // keying are ambiguous.
  const ids = parsed.data.fields.map((f) => f.id);
  if (new Set(ids).size !== ids.length) {
    return err(422, { code: "forms-intake.DUPLICATE_FIELD_ID", message: "Field ids must be unique within a form." }, meta);
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

  const event = {
    name: "forms-intake.form_created",
    correlationId: meta.correlationId,
    payload: { id, tenantId: form.tenantId, version: form.version }
  };

  return ok(201, { id, status: form.status, version: form.version, event }, meta);
}
