# Interactive Setup Contracts

Modules and templates may declare optional setup metadata in `module.json` or
`microservices.template.json`.

Use `interactive` for deterministic CLI setup:

```json
{
  "interactive": {
    "schema": "setup.schema.json",
    "command": "pnpm microservices setup email",
    "mode": "module-setup",
    "stores": {
      "config": "microservices.config.json",
      "secrets": "runtime-secret-store",
      "assets": "public/"
    }
  }
}
```

Use `skills` for optional agent guidance where judgment or messy input handling
is useful:

```json
{
  "skills": [
    {
      "id": "email-service-setup",
      "recommendedFor": ["provider-setup", "sender-domain"]
    }
  ]
}
```

Rules:

- `interactive.schema` is a package-relative JSON Schema path.
- Config and secret values must stay separate. Config may be written to
  `microservices.config.json`; secrets go only to the runtime secret store or
  approved local secret files.
- Provider side effects, production deploys, migrations, and secret writes remain
  approval-gated.
- Skills are recommendations, not required runtime dependencies.
