export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "recurring-documents",
  "name": "Recurring Documents",
  "version": "0.1.0",
  "status": "draft",
  "class": "core",
  "summary": "Recurring Documents module for microservices.sh templates.",
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
        "recurring_document_templates",
        "recurring_document_lines",
        "domain_events"
      ]
    }
  ],
  "permissions": [
    "recurring-documents.read",
    "recurring-documents.write",
    "recurring-documents.admin",
    "recurring-documents.extend",
    "recurring-documents.observe"
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
        "recurring-documents.created",
        "recurring-documents.updated",
        "recurring-documents.paused",
        "recurring-documents.resumed",
        "recurring-documents.cancelled",
        "recurring-documents.completed",
        "recurring-documents.generated"
      ],
      "consumes": []
    },
    "hookPoints": {
      "beforeRecurringDocumentsCreate": {
        "kind": "filter",
        "scope": "recurring-documents.extend"
      },
      "afterRecurringDocumentsUpdated": {
        "kind": "observer",
        "scope": "recurring-documents.observe"
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
          "label": "Recurring Documents",
          "path": "/recurring-documents",
          "permission": "recurring-documents.read"
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
        "recurring-documents.read",
        "recurring-documents.write"
      ],
      "skillPaths": [
        "skills/recurring-documents-operator/SKILL.md"
      ],
      "approvalRequiredFor": [
        "recurring-documents.write"
      ]
    }
  },
  "skills": [
    {
      "id": "recurring-documents-operator",
      "path": "skills/recurring-documents-operator/SKILL.md",
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
