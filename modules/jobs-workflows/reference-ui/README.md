# Jobs & Workflows Reference UI

Admin: job queue, retries, dead-letter queue, schedules, run details, and catch-up controls.

ERP shell example: `templates/erp-shell-sveltekit/src/routes/app/jobs`.

Visitor: not applicable. Jobs and workflows are internal async infrastructure.

Agentic: inspect jobs and schedules first. Require approval before enqueueing, running, retrying, or changing schedules.
