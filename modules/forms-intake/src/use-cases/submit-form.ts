import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { onSubmissionReceived } from "../hooks";
import { formsIntakeMeta } from "../meta";
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
//
// After an accepted submission the cross-module `onSubmissionReceived` observer
// hook chain (Plan 25 §5) runs, injected by the composed app via
// deps.onSubmissionHooks — observers may fan out to email/jobs-workflows. The
// local config seam `onSubmissionReceived` runs first (per-app override).
export async function submitForm(
  input: unknown,
  deps: {
    formStore: FormStore;
    turnstile?: TurnstileVerifier;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
    correlationId?: string;
    onSubmissionHooks?: ResolvedHook[];
  }
) {
  const meta = formsIntakeMeta(deps);

  const parsed = submitFormInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "forms-intake.INVALID_SUBMISSION_INPUT", message: "Submission input is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const form = await deps.formStore.getForm(parsed.data.formId, parsed.data.tenantId);
  if (!form) {
    return err(404, { code: "forms-intake.FORM_NOT_FOUND", message: "Form not found." }, meta);
  }
  if (form.status === "archived") {
    return err(409, { code: "forms-intake.FORM_ARCHIVED", message: "This form no longer accepts submissions." }, meta);
  }

  // 1. Spam protection (optional/configurable).
  if (form.requireTurnstile && deps.turnstile) {
    if (!parsed.data.turnstileToken) {
      return err(400, { code: "forms-intake.TURNSTILE_REQUIRED", message: "A Turnstile token is required for this form." }, meta);
    }
    const passed = await deps.turnstile.verify(parsed.data.turnstileToken, parsed.data.ip ?? undefined);
    if (!passed) {
      return err(403, { code: "forms-intake.TURNSTILE_FAILED", message: "Spam protection check failed." }, meta);
    }
  }

  // 2. Idempotency: dedup a retried submission before doing any persistence.
  if (parsed.data.idempotencyKey) {
    const fresh = await deps.formStore.recordSubmissionKey(form.id, parsed.data.idempotencyKey);
    if (!fresh) {
      return ok(200, { id: null, deduped: true, event: null }, meta);
    }
  }

  // 3. Validation via the PURE validator (conditional visibility handled there).
  const result = validateSubmission(form.fields, parsed.data.values);
  if (!result.ok) {
    return err(422, { code: "forms-intake.SUBMISSION_INVALID", message: "Submission failed validation.", issues: result.errors }, meta);
  }

  // 4. Attachment references: allowlist + size cap (mirror file-media). Refs only.
  const attachments: AttachmentRef[] = parsed.data.attachments;
  for (const att of attachments) {
    const attError = validateAttachment(att, cfg.allowedAttachmentTypes, cfg.maxAttachmentBytes);
    if (attError) {
      return err(415, { code: "forms-intake.ATTACHMENT_REJECTED", message: attError, issues: [{ fieldId: att.fieldId }] }, meta);
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

  // Local config seam, then the cross-module observer hook chain.
  await onSubmissionReceived(submission);
  await runHooks(
    "onSubmissionReceived",
    submission,
    { correlationId: meta.correlationId },
    deps.onSubmissionHooks ?? []
  );

  const event = {
    name: "forms-intake.submission_received",
    correlationId: meta.correlationId,
    payload: { id: submission.id, formId: submission.formId, tenantId: submission.tenantId }
  };

  return ok(201, { id: submission.id, deduped: false, event }, meta);
}
