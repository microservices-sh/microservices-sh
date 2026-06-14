export const manifest = {
  "schemaVersion": "2026-06-13",
  "id": "email",
  "name": "Email",
  "version": "0.1.0",
  "status": "available",
  "class": "provider",
  "summary": "Transactional email module with provider-neutral ports and a Resend HTTP adapter.",
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
        "email_deliveries",
        "domain_events"
      ]
    },
    {
      "type": "secret",
      "binding": "RESEND_API_KEY"
    },
    {
      "type": "outbound-fetch",
      "host": "api.resend.com"
    }
  ],
  "permissions": [
    "email.read",
    "email.write",
    "email.admin"
  ],
  "requires": [],
  "optional": [
    "auth",
    "audit-log",
    "customer"
  ],
  "hooks": [
    "beforeEmailSend",
    "afterEmailQueued",
    "afterEmailFailed"
  ],
  "events": [
    "email.queued",
    "email.sent",
    "email.failed"
  ],
  "customization": {
    "default": "config-hooks",
    "supported": [
      "config",
      "hooks",
      "overlay",
      "fork"
    ]
  },
  "approval": {
    "risk": "medium",
    "requiresApprovalFor": [
      "migrations",
      "pii-fields",
      "production-deploy",
      "sender-domain-change",
      "external-side-effects"
    ]
  }
} as const;

export const moduleDefinition = manifest;
