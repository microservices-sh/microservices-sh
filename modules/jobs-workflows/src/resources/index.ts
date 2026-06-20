export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["jobs", "job_runs", "job_schedules", "workflow_definitions", "workflow_runs", "workflow_step_runs"]
  },
  {
    type: "queue",
    binding: "JOBS_QUEUE",
    optional: true
  }
] as const;
