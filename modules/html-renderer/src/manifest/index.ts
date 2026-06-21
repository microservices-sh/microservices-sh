export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "html-renderer",
  "name": "Html Renderer",
  "version": "0.1.0",
  "status": "draft",
  "class": "utility",
  "summary": "HTML mockup publishing metadata with slug validation, TTL, assets, resolve, delete, and D1-backed records.",
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
        "html_render_documents",
        "domain_events"
      ]
    }
  ],
  "permissions": [
    "html-renderer.read",
    "html-renderer.write",
    "html-renderer.admin",
    "html-renderer.extend",
    "html-renderer.observe"
  ],
  "connections": {
    "requires": [],
    "optional": [
      "audit-log",
      "file-media"
    ],
    "rpc": {
      "exposes": [],
      "calls": []
    },
    "events": {
      "emits": [
        "html-renderer.created",
        "html-renderer.updated",
        "html-renderer.document.created",
        "html-renderer.document.resolved",
        "html-renderer.document.deleted"
      ],
      "consumes": []
    },
    "hookPoints": {
      "beforeHtmlRendererCreate": {
        "kind": "filter",
        "scope": "html-renderer.extend"
      },
      "afterHtmlRendererUpdated": {
        "kind": "observer",
        "scope": "html-renderer.observe"
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
          "label": "Html Renderer",
          "path": "/html-renderer",
          "permission": "html-renderer.read"
        }
      ],
      "referenceUi": [
        "reference-ui/admin/README.md"
      ]
    },
    "visitor": {
      "applicable": true,
      "referenceUi": [
        "reference-ui/visitor/README.md"
      ]
    },
    "agentic": {
      "applicable": true,
      "tools": [
        "html-renderer.read",
        "html-renderer.write"
      ],
      "skillPaths": [
        "skills/html-renderer-operator/SKILL.md"
      ],
      "approvalRequiredFor": [
        "html-renderer.write"
      ]
    }
  },
  "skills": [
    {
      "id": "html-renderer-operator",
      "path": "skills/html-renderer-operator/SKILL.md",
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
      "production-deploy",
      "external-side-effects"
    ]
  }
} as const;

export const moduleDefinition = manifest;
