export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "project-progress",
  "name": "Project Progress",
  "version": "0.1.0",
  "status": "draft",
  "class": "core",
  "summary": "Project progress timeline, worker access grants, media metadata, comments, and public customer snapshots.",
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
        "project_progress_projects",
        "project_progress_access",
        "project_progress_logs",
        "project_progress_media_files",
        "project_progress_comments",
        "domain_events"
      ]
    }
  ],
  "permissions": [
    "project-progress.read",
    "project-progress.write",
    "project-progress.admin",
    "project-progress.extend",
    "project-progress.observe"
  ],
  "connections": {
    "requires": [],
    "optional": [
      "auth",
      "customer",
      "file-media",
      "email",
      "notifications-inapp",
      "audit-log"
    ],
    "rpc": {
      "exposes": [],
      "calls": []
    },
    "events": {
      "emits": [
        "project-progress.created",
        "project-progress.updated",
        "project-progress.project.created",
        "project-progress.project.status-changed",
        "project-progress.access.granted",
        "project-progress.access.revoked",
        "project-progress.log.created",
        "project-progress.media.attached",
        "project-progress.comment.created"
      ],
      "consumes": []
    },
    "hookPoints": {
      "beforeProjectCreate": {
        "kind": "filter",
        "scope": "project-progress.extend"
      },
      "beforeProgressLogCreate": {
        "kind": "filter",
        "scope": "project-progress.extend"
      },
      "afterProgressLogCreated": {
        "kind": "observer",
        "scope": "project-progress.observe"
      },
      "afterCommentCreated": {
        "kind": "observer",
        "scope": "project-progress.observe"
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
          "label": "Project Progress",
          "path": "/project-progress",
          "permission": "project-progress.read"
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
        "project-progress.read",
        "project-progress.write"
      ],
      "skillPaths": [
        "skills/project-progress-operator/SKILL.md"
      ],
      "approvalRequiredFor": [
        "project-progress.write"
      ]
    }
  },
  "skills": [
    {
      "id": "project-progress-operator",
      "path": "skills/project-progress-operator/SKILL.md",
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
      "public-access-token",
      "media-upload-integration",
      "production-deploy",
      "external-side-effects"
    ]
  }
} as const;

export const moduleDefinition = manifest;
