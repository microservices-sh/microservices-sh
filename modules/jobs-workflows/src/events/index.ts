// Platform module: emits job lifecycle events. Consumes scheduled-tick ticks via
// the dueScheduledJobs use case (driven by a Cron Trigger in the app).
export const events = {
  emitted: [
    "job.enqueued",
    "job.succeeded",
    "job.retried",
    "job.dead",
    "job.scheduled",
    "workflow.defined",
    "workflow.started",
    "workflow.step.succeeded",
    "workflow.step.failed",
    "workflow.waiting",
    "workflow.succeeded",
    "workflow.failed"
  ],
  consumed: []
} as const;
