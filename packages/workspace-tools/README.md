# Workspace Tools

Reusable repo-local commands for validating microservices.sh module and template packages.

## Commands

```bash
pnpm spec:check -- all
pnpm spec:check -- modules
pnpm spec:check -- templates
pnpm spec:check -- module modules/booking
pnpm spec:check -- template templates/booking-sveltekit
pnpm scaffold:module -- inventory
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
pnpm registry:build -- --json
pnpm discover -- --json
pnpm discover -- --path templates/booking-sveltekit --json
```

Package scripts should call the shared checker directly:

```json
{
  "scripts": {
    "check:spec": "node ../../packages/workspace-tools/src/index.js check module --path ."
  }
}
```

Use `microservices.check.mjs` in a module or template root for package-specific invariants that cannot be inferred from manifests.

## Scaffolding

```bash
pnpm scaffold:module -- inventory --name "Inventory" --summary "Inventory records, stock state, and inventory events."
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
```

The scaffold command writes a valid package shape, shared `check:spec` script, manifest, docs, LLM guide, and `microservices.check.mjs` policy file. It refuses to overwrite files unless `--force` is passed.

## Registry And Discovery

```bash
pnpm registry:build -- --json
pnpm discover -- --path templates/booking-sveltekit --json
```

`registry build` scans local module and template manifests and writes derived JSON under `.generated/registry`.

`discover` is read-only. It reports available local modules/templates plus installed app modules when the target path contains `microservices.lock.json`, `microservices.config.json`, or first-party module dependencies such as `@microservices-sh/booking`. Use this output to create integration plans; do not auto-apply migrations, secrets, webhooks, Cloudflare resources, or provider side effects.
