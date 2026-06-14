# Template Specs

Templates are predefined starting repositories for generated apps. They are not disconnected boilerplates. Each template must be composed from module contracts, include a lockfile, expose LLM-readable docs, and support upgrade planning.

## Current Specs

- `template-spec-standard.md` - standard every template spec must follow.
- `booking-sveltekit.md` - full Cloudflare SvelteKit booking app template spec.
- `../../templates/booking-sveltekit` - concrete official template shell in this repo.

## Template Rule

A template can own app shell, routing, layout, sample content, and composition glue. Domain behavior must live in modules or documented template hooks so agents can customize safely and upgrades remain possible.

## Recommended Order

1. `booking-sveltekit` - full product proof with UI, API routes, D1, KV, hooks, and managed preview.
2. `landing-page` - marketing site with waitlist/contact capture and analytics.
3. `blog-content` - content foundation with posts, authors, tags, RSS/sitemap, SEO metadata, and optional email capture.

The future generated `landing-page` template is distinct from the private `microservices-sh/landing-page` marketing-site repo.
