import { ok, err } from "@microservices-sh/connection-contract";
import { formsIntakeMeta } from "../meta";
import { reviewSubmissionInputSchema } from "../schemas";
import type { FormStore } from "../ports";
import type { SubmissionStatus } from "../types";

// Only these states accept a review decision. `approved`/`rejected` are terminal,
// so re-reviewing one is a conflict (409) rather than a silent overwrite — the
// guard agents skip, which lets a second reviewer quietly flip an already-final
// decision and lose the audit trail.
const REVIEWABLE: SubmissionStatus[] = ["pending", "changes_requested"];

// Apply a moderation decision to one submission. Tenant-scoped: a reviewer can
// only act on submissions inside their own tenant. The submitted values and
// attachments are never mutated here — only status + review metadata — so a
// reviewed submission keeps the exact data it was validated with.
//
// Emits `forms-intake.submission_reviewed` (carrying the decision) so a host can
// fan out to audit-log / email / notifications via the event bus.
export async function reviewSubmission(
  input: unknown,
  deps: { formStore: FormStore; now?: () => number; correlationId?: string }
) {
  const meta = formsIntakeMeta(deps);

  const parsed = reviewSubmissionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "forms-intake.INVALID_REVIEW_INPUT", message: "Review input is invalid.", issues: parsed.error.issues }, meta);
  }

  const submission = await deps.formStore.getSubmission(parsed.data.submissionId, parsed.data.tenantId);
  if (!submission) {
    return err(404, { code: "forms-intake.SUBMISSION_NOT_FOUND", message: "Submission not found." }, meta);
  }

  if (!REVIEWABLE.includes(submission.status)) {
    return err(
      409,
      {
        code: "forms-intake.SUBMISSION_NOT_REVIEWABLE",
        message: `Submission is ${submission.status}; only pending or changes_requested submissions can be reviewed.`
      },
      meta
    );
  }

  submission.status = parsed.data.decision;
  submission.reviewedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  submission.reviewedBy = parsed.data.reviewedBy;
  submission.reviewNote = parsed.data.note ?? null;
  await deps.formStore.updateSubmission(submission);

  const event = {
    name: "forms-intake.submission_reviewed",
    correlationId: meta.correlationId,
    payload: {
      id: submission.id,
      formId: submission.formId,
      tenantId: submission.tenantId,
      status: submission.status,
      reviewedBy: submission.reviewedBy
    }
  };

  return ok(
    200,
    {
      id: submission.id,
      status: submission.status,
      reviewedAt: submission.reviewedAt,
      reviewedBy: submission.reviewedBy,
      event
    },
    meta
  );
}
