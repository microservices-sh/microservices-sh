import type { Form, FormSubmission } from "./types";

// Customization seam: inspect/adjust a form just before it is published (field
// set frozen). Return null to abort the publish. Default pass-through.
export async function beforeFormPublish(form: Form): Promise<Form | null> {
  return form;
}

// Customization seam: react to an accepted submission, e.g. enqueue a
// notification via jobs-workflows, or forward to a CRM. Runs after validation,
// spam check, and dedup all pass. Default no-op.
export async function onSubmissionReceived(_submission: FormSubmission): Promise<void> {
  return;
}
