export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "hr-people-ops",
  "name": "Hr People Ops",
  "version": "0.1.0",
  "status": "draft",
  "class": "core",
  "summary": "Employee directory, departments, positions, leave balances, leave requests, and attendance for internal-ops templates.",
  "runtime": {
    "language": "typescript",
    "platform": "cloudflare-workers",
    "frameworkNeutral": true,
    "routeAdapters": [
      "hono-later",
      "sveltekit-later"
    ]
  },
  "entrypoint": "src/index.ts",
  "resources": [
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
  ],
  "permissions": [
    "hr-people-ops.read",
    "hr-people-ops.write",
    "hr-people-ops.admin",
    "hr-people-ops.extend",
    "hr-people-ops.observe"
  ],
  "connections": {
    "requires": [],
    "optional": [
      "auth",
      "audit-log"
    ],
    "rpc": {
      "exposes": [],
      "calls": []
    },
    "events": {
      "emits": [
        "hr-people-ops.created",
        "hr-people-ops.updated",
        "hr-people-ops.employee.created",
        "hr-people-ops.leave.requested",
        "hr-people-ops.leave.approved",
        "hr-people-ops.leave.rejected",
        "hr-people-ops.leave.cancelled",
        "hr-people-ops.attendance.recorded"
      ],
      "consumes": []
    },
    "hookPoints": {
      "beforeHrPeopleOpsCreate": {
        "kind": "filter",
        "scope": "hr-people-ops.extend"
      },
      "afterHrPeopleOpsUpdated": {
        "kind": "observer",
        "scope": "hr-people-ops.observe"
      }
    },
    "provides": {
      "hooks": []
    }
  },
  "customization": {
    "default": "config-hooks",
    "supported": [
      "config",
      "hooks",
      "overlay",
      "fork"
    ]
  },
  "surfaces": {
    "admin": {
      "applicable": true,
      "nav": [
        {
          "label": "Hr People Ops",
          "path": "/hr-people-ops",
          "permission": "hr-people-ops.read"
        }
      ],
      "referenceUi": [
        "reference-ui/admin/README.md"
      ]
    },
    "visitor": {
      "applicable": false,
      "referenceUi": [
        "reference-ui/visitor/README.md"
      ]
    },
    "agentic": {
      "applicable": true,
      "tools": [
        "hr-people-ops.read",
        "hr-people-ops.write"
      ],
      "skillPaths": [
        "skills/hr-people-ops-operator/SKILL.md"
      ],
      "approvalRequiredFor": [
        "hr-people-ops.write"
      ]
    }
  },
  "skills": [
    {
      "id": "hr-people-ops-operator",
      "path": "skills/hr-people-ops-operator/SKILL.md",
      "recommendedFor": [
        "admin-operations",
        "agentic-tools"
      ]
    }
  ],
  "approval": {
    "risk": "medium",
    "requiresApprovalFor": [
      "migrations",
      "pii-fields",
      "production-deploy",
      "external-side-effects"
    ]
  }
} as const;

export const moduleDefinition = manifest;
