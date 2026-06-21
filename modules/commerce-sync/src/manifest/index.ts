export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "commerce-sync",
  "name": "Commerce Sync",
  "version": "0.1.0",
  "status": "draft",
  "class": "core",
  "summary": "Provider-neutral commerce connections, mappings, sync runs, webhook receipts, and normalized payload envelopes.",
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
        "commerce_sync_connections",
        "commerce_sync_mappings",
        "commerce_sync_runs",
        "commerce_sync_webhook_receipts",
        "commerce_sync_envelopes",
        "domain_events"
      ]
    }
  ],
  "permissions": [
    "commerce-sync.read",
    "commerce-sync.write",
    "commerce-sync.admin",
    "commerce-sync.extend",
    "commerce-sync.observe"
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
        "commerce-sync.created",
        "commerce-sync.updated"
      ],
      "consumes": []
    },
    "hookPoints": {
      "beforeCommerceSyncCreate": {
        "kind": "filter",
        "scope": "commerce-sync.extend"
      },
      "afterCommerceSyncUpdated": {
        "kind": "observer",
        "scope": "commerce-sync.observe"
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
          "label": "Commerce Sync",
          "path": "/commerce-sync",
          "permission": "commerce-sync.read"
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
        "commerce-sync.read",
        "commerce-sync.write"
      ],
      "skillPaths": [
        "skills/commerce-sync-operator/SKILL.md"
      ],
      "approvalRequiredFor": [
        "commerce-sync.write"
      ]
    }
  },
  "skills": [
    {
      "id": "commerce-sync-operator",
      "path": "skills/commerce-sync-operator/SKILL.md",
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
