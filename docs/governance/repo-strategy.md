# Repository Strategy

## Current Decision

Keep `microservices-sh/microservices-sh` as the core platform monorepo.

This repo should own:

- `packages/create-microservices-app`
- `packages/cli`
- `packages/sdk-internal`
- `packages/module-contract`
- `apps/api`
- pinned module snapshots under `modules/` for private release and template generation
- official template sources under `templates/`
- contribution, security, CI, and release governance

Public module source and module PRs should live in the public `microservices-sh/modules` repo. The private core repo may keep a pinned copy of accepted public modules so create-app, templates, and managed releases can build without live network access.

The product marketing site should live outside the core monorepo in the private `microservices-sh/landing-page` repo. Keep it private until the public source policy, launch copy, analytics, and deployment workflow are explicitly reviewed for external visibility.

Do not turn the core monorepo itself into a generated app template repo.

## Recommended Local Layout

Use one parent folder with one Git checkout per repo:

```text
microservices-sh/
  microservices-sh/   private core repo
  modules/            public module repo
  registry/           public registry metadata repo
  landing-page/       private marketing site repo
  dispatcher/         private dispatch Worker repo
```

Do not nest public repos inside the private core repo. Each repo has its own lifecycle, branch rules, CI, and review surface.

## Recommended Repo Split

Create repos only when they have a distinct lifecycle:

| Repo | Create now? | Purpose |
| --- | --- | --- |
| `microservices-sh` | Yes, existing | Core platform monorepo |
| `modules` | Yes, existing | Public module source, module PRs, module CI, and contributor docs |
| `landing-page` | Yes, existing | Private Astro marketing site and Cloudflare landing deploy workflow |
| `registry` | Yes | Public/read-only catalog metadata for modules and templates |
| `template-booking-sveltekit` | Later | GitHub template repo generated from the official template when stable |
| `payment-stripe` | Later | Standalone provider module only if it needs independent ownership |
| `email-*` | Later | Standalone provider modules only if they need independent ownership |

Avoid creating one repo per planned module before the module contract, registry format, and ownership model are stable.

## Public Modules Repo

The public `microservices-sh/modules` repo is the default place for:

- module proposals
- official module source changes
- third-party provider module work
- module tests, schemas, migrations, and docs
- module review gates and CODEOWNERS

Keep paths stable as `modules/<module-id>` so accepted changes can be imported into this private repo with low friction. Maintainers should record the public modules commit, tag, or PR when importing a snapshot into private core.

Do not put hosted control-plane code, billing logic, deployment credentials, private API endpoints, customer data, production logs, or unreleased commercial roadmap in the public modules repo.

## Registry Repo

The registry repo should be treated as metadata and discovery infrastructure, not as the source of all module code.

It should contain:

- generated catalog JSON
- module/template index files
- verification metadata
- links to source repos or package versions
- ownership and maturity status

It should not contain secrets, provider credentials, customer data, or generated app artifacts.

## Template Repos

Use separate GitHub template repos only for stable generated starter projects.

A template repo should include:

- generated source
- `microservices.lock.json`
- `README.agent.md`
- `docs/llms.txt`
- project CLI
- upgrade-plan support
- clear note that canonical source lives in the platform monorepo

Template repos should be regenerated through a controlled release process, not manually edited into drift.

## Third-Party Module Repos

Third-party modules should start in `microservices-sh/modules` or an external contributor repo, then be listed in `microservices-sh/registry` when evidence is sufficient.

Promotion stages:

1. Proposal issue in `microservices-sh/modules`.
2. Public experimental module PR or external repo/package.
3. Registry listing with maturity status.
4. Verified module after tests, docs, security review, and ownership are clear.
5. Official module only when maintainers accept long-term support.

This keeps the core platform stable while still allowing module ecosystem growth.
