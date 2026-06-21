export const hrPeopleOpsResources = [
  {
    "type": "d1",
    "binding": "DB",
    "tables": [
      "hr_departments",
      "hr_positions",
      "hr_employees",
      "hr_leave_types",
      "hr_leave_balances",
      "hr_leave_requests",
      "hr_attendance_records",
      "domain_events"
    ]
  }
] as const;
