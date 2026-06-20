# Quickstart Proof

Last checked: 2026-06-20

This records a clean default quickstart using a packed `create-microservices-app` artifact and a generated app under `/tmp`, not a workspace-linked app.

## Environment
- Source package: `create-microservices-app-0.4.3.tgz`
- Generated app: `/tmp/ms-clean-quickstart-20260620-024358/studio-booking`
- Template: `booking-sveltekit`
- Install mode for first check: `--no-install --no-git`

## Commands Run

```bash
pnpm --filter create-microservices-app build
pnpm --filter create-microservices-app pack --pack-destination /tmp/ms-quickstart-pack-20260620-024358
tar -xzf /tmp/ms-quickstart-pack-20260620-024358/create-microservices-app-0.4.3.tgz -C /tmp/ms-clean-quickstart-20260620-024358
node /tmp/ms-clean-quickstart-20260620-024358/package/dist/index.js studio-booking \
  --template booking-sveltekit \
  --dir /tmp/ms-clean-quickstart-20260620-024358 \
  --no-install \
  --no-git \
  --json
pnpm --dir /tmp/ms-clean-quickstart-20260620-024358/studio-booking microservices check --json
```

Result: pass.

Time from extracted package artifact to generated app `microservices check`: **2.69 seconds**.

The generated app reported:

- `ok: true`
- template: `booking-sveltekit`
- modules: `gateway`, `auth`, `customer`, `booking`, `audit-log`, `payment`, `identity`
- checks passed: manifest, lockfile, API boundary, wrangler config, migrations, HTTP smoke policy, route specs, migration specs, login route spec, no-local-booking-module policy

## Install Follow-Up

Offline install was attempted first:

```bash
pnpm --dir /tmp/ms-clean-quickstart-20260620-024358/studio-booking install --offline
```

Result: failed because `@cloudflare/workers-types` was missing from the local pnpm store. This is expected on a cold machine without a package cache.

Network install then succeeded:

```bash
pnpm --dir /tmp/ms-clean-quickstart-20260620-024358/studio-booking install
```

Result: pass in **12.3 seconds**.

Post-install checks:

```bash
pnpm --dir /tmp/ms-clean-quickstart-20260620-024358/studio-booking microservices check --json
pnpm --dir /tmp/ms-clean-quickstart-20260620-024358/studio-booking microservices modules list --json
pnpm --dir /tmp/ms-clean-quickstart-20260620-024358/studio-booking microservices add payment --plan --json
```

Results:

- `microservices check --json`: pass.
- `modules list --json`: pass; app-local module contracts are readable.
- `add payment --plan --json`: pass; reports plan-only output and writes nothing.

## Launch Use
Use this as the current no-signup proof path:

```bash
pnpm create microservices-app@latest studio-booking --template booking-sveltekit
cd studio-booking
pnpm install
pnpm microservices check --json
pnpm microservices modules list --json
pnpm microservices add payment --plan --json
```

Keep managed deploy language to planning/readiness until hosted Worker/assets upload and route activation are verified live.
