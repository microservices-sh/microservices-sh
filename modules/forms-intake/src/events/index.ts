// Vertical intake module: emits form lifecycle + submission events. Hosts can
// fan submission_received out to email/jobs-workflows for notifications.
export const events = {
  emitted: [
    "forms-intake.form_created",
    "forms-intake.form_updated",
    "forms-intake.submission_received",
    "forms-intake.submission_reviewed"
  ],
  consumed: []
} as const;
