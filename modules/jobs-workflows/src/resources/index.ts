export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["jobs", "job_runs", "job_schedules"]
  },
  {
    type: "queue",
    binding: "JOBS_QUEUE",
    optional: true
  }
] as const;
