export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "storage-entitlements",
  "name": "Storage Entitlements",
  "version": "0.1.0",
  "status": "draft",
  "class": "core",
  "summary": "Storage Entitlements module for microservices.sh templates.",
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
        "storage_accounts",
        "storage_packages",
        "storage_purchases",
        "storage_share_links"
      ]
    }
  ],
  "permissions": [
    "storage-entitlements.read",
    "storage-entitlements.write",
    "storage-entitlements.admin",
    "storage-entitlements.extend",
    "storage-entitlements.observe"
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
        "storage-entitlements.created",
        "storage-entitlements.updated",
        "storage-entitlements.quota.updated",
        "storage-entitlements.purchase.completed",
        "storage-entitlements.share.created",
        "storage-entitlements.share.downloaded",
        "storage-entitlements.share.revoked"
      ],
      "consumes": []
    },
    "hookPoints": {
      "beforeStorageEntitlementsCreate": {
        "kind": "filter",
        "scope": "storage-entitlements.extend"
      },
      "afterStorageEntitlementsUpdated": {
        "kind": "observer",
        "scope": "storage-entitlements.observe"
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
          "label": "Storage Entitlements",
          "path": "/storage-entitlements",
          "permission": "storage-entitlements.read"
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
        "storage-entitlements.read",
        "storage-entitlements.write"
      ],
      "skillPaths": [
        "skills/storage-entitlements-operator/SKILL.md"
      ],
      "approvalRequiredFor": [
        "storage-entitlements.write"
      ]
    }
  },
  "skills": [
    {
      "id": "storage-entitlements-operator",
      "path": "skills/storage-entitlements-operator/SKILL.md",
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
