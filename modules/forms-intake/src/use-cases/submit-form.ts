import { defaultConfig } from "../config";
import { onSubmissionReceived } from "../hooks";
import { submitFormInputSchema } from "../schemas";
import { validateAttachment, validateSubmission } from "../validate-submission";
import type { FormStore, TurnstileVerifier } from "../ports";
import type { AttachmentRef, FormSubmission } from "../types";

// Submit to a form. The ordering of guards matters and is the value here:
//
//   1. spam check (Turnstile)  — cheapest gate, reject bots before doing work
//   2. idempotency dedup       — a retried POST must not double-store
//   3. validation (PURE)       — interpret the stored field set; conditional
//                                visibility means hidden-but-required fields are
//                                NOT required
//   4. attachment refs         — content-type allowlist + size cap (refs only)
//   5. persist + emit
//
// Turnstile is OPTIONAL: only enforced when the form requires it AND a verifier is
// injected. fetch is NEVER called here — the adapter does it behind the port.
export async function submitForm(
  input: unknown,
  deps: {
    formStore: FormStore;
    turnstile?: TurnstileVerifier;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
  }
) {
  const parsed = submitFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_SUBMISSION_INPUT", message: "Submission input is invalid.", issues: parsed.error.issues }
    };
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const form = await deps.formStore.getForm(parsed.data.formId, parsed.data.tenantId);
  if (!form) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "FORM_NOT_FOUND", message: "Form not found." } };
  }
  if (form.status === "archived") {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "FORM_ARCHIVED", message: "This form no longer accepts submissions." } };
  }

  // 1. Spam protection (optional/configurable).
  if (form.requireTurnstile && deps.turnstile) {
    if (!parsed.data.turnstileToken) {
      return {
        ok: false as const,
        status: 400 as const,
        data: null,
        error: { code: "TURNSTILE_REQUIRED", message: "A Turnstile token is required for this form." }
      };
    }
    const passed = await deps.turnstile.verify(parsed.data.turnstileToken, parsed.data.ip ?? undefined);
    if (!passed) {
      return {
        ok: false as const,
        status: 403 as const,
        data: null,
        error: { code: "TURNSTILE_FAILED", message: "Spam protection check failed." }
      };
    }
  }

  // 2. Idempotency: dedup a retried submission before doing any persistence.
  if (parsed.data.idempotencyKey) {
    const fresh = await deps.formStore.recordSubmissionKey(form.id, parsed.data.idempotencyKey);
    if (!fresh) {
      return { ok: true as const, status: 200 as const, data: { id: null, deduped: true } };
    }
  }

  // 3. Validation via the PURE validator (conditional visibility handled there).
  const result = validateSubmission(form.fields, parsed.data.values);
  if (!result.ok) {
    return {
      ok: false as const,
      status: 422 as const,
      data: null,
      error: { code: "SUBMISSION_INVALID", message: "Submission failed validation.", fieldErrors: result.errors }
    };
  }

  // 4. Attachment references: allowlist + size cap (mirror file-media). Refs only.
  const attachments: AttachmentRef[] = parsed.data.attachments;
  for (const att of attachments) {
    const attError = validateAttachment(att, cfg.allowedAttachmentTypes, cfg.maxAttachmentBytes);
    if (attError) {
      return {
        ok: false as const,
        status: 415 as const,
        data: null,
        error: { code: "ATTACHMENT_REJECTED", message: attError, fieldId: att.fieldId }
      };
    }
  }

  // 5. Persist + emit.
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const submission: FormSubmission = {
    id: "sub_" + crypto.randomUUID().slice(0, 16),
    formId: form.id,
    tenantId: form.tenantId,
    values: result.activeValues,
    attachments,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
    submittedAt: nowIso
  };
  await deps.formStore.insertSubmission(submission);

  await onSubmissionReceived(submission);

  return { ok: true as const, status: 201 as const, data: { id: submission.id, deduped: false } };
}
