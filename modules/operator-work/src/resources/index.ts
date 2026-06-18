export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "operator_tasks",
      "operator_subtasks",
      "operator_focus_blocks",
      "operator_daily_reviews",
      "domain_events"
    ]
  }
] as const;
