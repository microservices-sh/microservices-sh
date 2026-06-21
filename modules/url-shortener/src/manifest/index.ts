export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "url-shortener",
  "name": "Url Shortener",
  "version": "0.1.0",
  "status": "draft",
  "class": "utility",
  "summary": "Tenant-scoped short links, redirect resolution, expiry, deactivation, click analytics, and recent-link reporting.",
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
        "url_short_links",
        "url_short_link_clicks",
        "domain_events"
      ]
    }
  ],
  "permissions": [
    "url-shortener.read",
    "url-shortener.write",
    "url-shortener.admin",
    "url-shortener.extend",
    "url-shortener.observe"
  ],
  "connections": {
    "requires": [],
    "optional": [
      "audit-log",
      "analytics"
    ],
    "rpc": {
      "exposes": [],
      "calls": []
    },
    "events": {
      "emits": [
        "url-shortener.created",
        "url-shortener.updated",
        "url-shortener.link.created",
        "url-shortener.link.resolved",
        "url-shortener.link.deactivated",
        "url-shortener.click.recorded"
      ],
      "consumes": []
    },
    "hookPoints": {
      "beforeUrlShortenerCreate": {
        "kind": "filter",
        "scope": "url-shortener.extend"
      },
      "afterUrlShortenerUpdated": {
        "kind": "observer",
        "scope": "url-shortener.observe"
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
          "label": "Url Shortener",
          "path": "/url-shortener",
          "permission": "url-shortener.read"
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
        "url-shortener.read",
        "url-shortener.write"
      ],
      "skillPaths": [
        "skills/url-shortener-operator/SKILL.md"
      ],
      "approvalRequiredFor": [
        "url-shortener.write"
      ]
    }
  },
  "skills": [
    {
      "id": "url-shortener-operator",
      "path": "skills/url-shortener-operator/SKILL.md",
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
