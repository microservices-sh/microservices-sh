# create-microservices-app

Create a microservices.sh app from verified Cloudflare-native modules.

```bash
npm create microservices-app@latest studio-booking -- --template booking-sveltekit
pnpm create microservices-app@latest studio-booking --template booking-sveltekit
pnpm create microservices-app@latest --interactive
```

`studio-booking` is only the generated app directory and slug. The current full app template id is `booking-sveltekit`; there is no `booking-svelte` template, and `booking-demo` is not a special template name.

The generated app includes:

- Hono + Cloudflare Workers runtime, or the full SvelteKit booking template
- D1 schema and Wrangler config
- `microservices.lock.json`
- LLM-readable module docs under `docs/`
- project CLI script exposed as `pnpm microservices`
- `updates`, `upgrade --plan`, `add --plan`, `secrets status`, and `check` foundations

For local scaffold testing inside this repo:

```bash
pnpm --filter create-microservices-app start -- studio-booking --template booking-sveltekit --no-install
```

Useful setup flags:

```bash
pnpm create microservices-app@latest worker-booking --template booking-business --modules payment-stripe,email
pnpm create microservices-app@latest studio-booking --template booking-sveltekit
pnpm create microservices-app@latest studio-booking --template booking-sveltekit --git-repo git@github.com:acme/studio-booking.git
pnpm create microservices-app@latest --interactive
```

`booking-business` is the default Cloudflare Worker/Hono app generated from the module contract. `booking-sveltekit` is a full Cloudflare SvelteKit app template bundled with source-visible customer and booking modules through local `file:` dependencies, so the generated app can install and build outside this monorepo.

For the SvelteKit template local baseline:

```bash
pnpm create microservices-app@latest studio-booking --template booking-sveltekit
cd studio-booking
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

The generated SvelteKit app also includes approval-gated managed preview commands. These proxy to the microservices.sh API; they do not require users to run `wrangler login`, create D1/KV resources, or paste Cloudflare ids.

```bash
pnpm microservices auth login
pnpm microservices deploy doctor
pnpm microservices deploy preview --plan
pnpm microservices deploy preview --confirm deploy --output deployment.json
pnpm microservices deploy provision --input deployment.json --plan
pnpm microservices deploy provision --input deployment.json --confirm provision
pnpm microservices deploy migrate --input deployment.json --plan
pnpm microservices deploy migrate --input deployment.json --confirm migrate
pnpm microservices deploy upload-plan --input deployment.json
pnpm microservices deploy upload --input deployment.json --plan
pnpm microservices deploy status --input deployment.json
pnpm microservices deploy cleanup --input deployment.json --plan
pnpm microservices preview smoke --url <preview-url>
```

Remote deployment preparation, resource provisioning, remote migration, hosted upload attempts, and cleanup require explicit approval. The control-plane API owns remote state and resource ids; the generated `wrangler.jsonc` remains a local-dev config. Hosted Worker upload is still blocked until the API has a deploy-ready Worker/assets bundle, surfaced by `microservices deploy upload-plan --input deployment.json`, so the template is ready for local testing before it is ready for full live preview testing.

`microservices deploy preview --confirm deploy` builds locally, packages the Cloudflare SvelteKit output, and uploads that artifact to the microservices.sh API. In CI, use:

```bash
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy preview --confirm deploy --ci --json --output deployment.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy provision --input deployment.json --confirm provision --ci --json --output provision.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy migrate --input deployment.json --confirm migrate --ci --json --output migrate.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy upload-plan --input deployment.json --ci --json --output upload-plan.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy cleanup --input deployment.json --confirm cleanup --ci --json --output cleanup.json
```

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
