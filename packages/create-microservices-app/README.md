# create-microservices-app

Create a microservices.sh app from verified Cloudflare-native modules.

```bash
npm create microservices-app@latest booking-demo
pnpm create microservices-app booking-demo
pnpm create microservices-app --interactive
```

The generated app includes:

- Hono + Cloudflare Workers runtime, or the full SvelteKit booking template
- D1 schema and Wrangler config
- `microservices.lock.json`
- LLM-readable module docs under `docs/`
- project CLI script exposed as `pnpm microservices`
- `updates`, `upgrade --plan`, `add --plan`, `secrets status`, and `check` foundations

For local scaffold testing inside this repo:

```bash
pnpm --filter create-microservices-app start -- booking-demo --no-install
```

Useful setup flags:

```bash
pnpm create microservices-app booking-demo --template booking-business --modules payment-stripe,email
pnpm create microservices-app booking-ui --template booking-sveltekit
pnpm create microservices-app booking-demo --git-repo git@github.com:acme/booking-demo.git
pnpm create microservices-app --interactive
```

`booking-business` is the default Cloudflare Worker/Hono app generated from the module contract. `booking-sveltekit` is a full Cloudflare SvelteKit app template bundled with source-visible customer and booking modules through local `file:` dependencies, so the generated app can install and build outside this monorepo.

For the SvelteKit template local baseline:

```bash
pnpm create microservices-app booking-ui --template booking-sveltekit
cd booking-ui
pnpm microservices local setup
pnpm dev
pnpm microservices local smoke
```

Run `microservices local smoke` in a second terminal after `pnpm dev` starts. `pnpm dev` applies checked-in migrations to Wrangler's local D1 database before starting Vite.

If port 5174 is busy:

```bash
pnpm dev -- --port 5175
pnpm microservices local smoke --url http://127.0.0.1:5175
```

The generated SvelteKit app also includes approval-gated preview deployment commands:

```bash
pnpm microservices preview bind --d1-id <database-id> --kv-id <namespace-id>
pnpm microservices preview doctor
pnpm microservices preview deploy --dry-run
pnpm microservices preview migrate --confirm migrate
pnpm microservices preview deploy --confirm deploy
pnpm microservices preview smoke --url https://<worker-url>
```

Remote D1 migrations and preview deploys require explicit approval and real Cloudflare resource IDs in `wrangler.jsonc`. Use `microservices preview bind` to update those ids. The create CLI patches the generated Worker name to the app slug so multiple generated apps do not deploy under the fixed template name.

Interactive setup asks for project name, template, extra modules, an optional Git remote, and package manager. Template, module, and package-manager prompts show numbered choices and accept either numbers or ids; enter nothing or `none` for template defaults. Available modules are generated immediately; planned modules are returned as follow-up `add --plan` commands. Local generation still works without login.

Distribution builds bundle the internal generator into `dist/index.js`:

```bash
pnpm --filter create-microservices-app build
pnpm --filter create-microservices-app pack --dry-run
pnpm --filter create-microservices-app smoke
```

Generated projects support:

```bash
pnpm microservices updates --json
pnpm microservices upgrade booking --plan --json
pnpm microservices add payment-stripe --plan --json
pnpm microservices check --json
```

## Release

The repository includes a manual GitHub Actions workflow at `.github/workflows/npm-publish.yml`.

Default runs use `dry_run=true`. A real publish requires:

- `NPM_PUBLISH_ENABLED=true` as a GitHub repository variable
- `NPM_TOKEN` as a GitHub repository secret

Do not run a real publish until the version and license are finalized.
