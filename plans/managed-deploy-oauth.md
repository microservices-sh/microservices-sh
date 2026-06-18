# Managed deploy to user's own Cloudflare (1-click, hands-off)

Spec 2026-06-17. Goal: a visitor connects their Cloudflare once, and we provision + migrate + deploy a working booking app into their account - no CLI, no secrets, no migrations on their side. Deploys to their account (no lock-in, their cost), while microservices.sh does the work. For ICP #2 (semi-technical founder, already on Cloudflare). Supersedes the hosted-expiring-preview idea.

## Target flow
```
Connect Cloudflare (OAuth consent OR paste a scoped API token)
  -> provision D1 + KV in their account
  -> run migrations (D1 query API)
  -> upload prebuilt Worker artifact + bind D1/KV
  -> set vars: our managed EMAIL relay (so passwordless login works out-of-box)
  -> live at <app>.<their-subdomain>.workers.dev
```

## Requirement state (verified against the sibling hosted API repo and local template docs, 2026-06-17)
- Done: **Provision D1/KV** - `control-plane.ts`, gated `CF_PROVISIONING_ENABLED=true` + a token.
- Done: **Migrations** - `POST .../d1/database/{id}/query` runs the booking migrations. The current booking template has 11 migrations.
- Done: **Worker + assets upload** - `.../workers/scripts/{name}` + assets-upload-session.
- Done: **Vars/bindings at upload** - `plain_text` supported (inject email relay).
- Done: **Custom hostname** - flow exists (`CF_CUSTOM_HOSTNAMES_ENABLED`); default `*.workers.dev` needs nothing.
- Blocked: **Built artifact without the user's machine (BLOCKER 1)** - upload needs a prebuilt Worker artifact, either a `.microservices/deploy-bundle/_worker.js` bundle or raw SvelteKit Cloudflare output (`.svelte-kit/cloudflare/_worker.js` + server modules + manifest). A Worker cannot `vite build`; prebuild in CI.
- Blocked: **OAuth token acquire/store/resolve (BLOCKER 2)** - only scaffolded (`cloudflare-connections.ts`: status + records; token is not acquired/used; deploys still need a supplied `CLOUDFLARE_API_TOKEN`). The **api-token** connection path is further along than OAuth.
- Risk: **Managed email relay** - `EMAIL_SERVICE_URL`/key exist; must inject into the deployed Worker so login codes send. This creates cost and abuse exposure.

## The two keystone decisions
1. **Where the build happens.** Options:
   - **Prebuilt template artifact (recommended):** the booking build output is template-deterministic - build it once in CI, store it in R2 or an artifact table keyed by template+version, and apply per-user diffs (app name, binding ids) at upload. This unblocks BLOCKER 1 and keeps the flow hands-off.
   - CF Workers Builds (builds from a repo in their account): the native "Deploy to Cloudflare button" path, but a different architecture.
   - User CLI builds + uploads: not hands-off.
2. **Auth: API token vs OAuth.**
   - **Scoped API token paste (recommended first):** user creates a Cloudflare API token with Workers/D1/KV scopes and pastes it once. This is mostly built through api-token connections. For a security-conscious ICP, this can be better than OAuth because the token is scoped and revocable, and it avoids the OAuth security surface.
   - **OAuth (true 1-click, later):** authorize -> code exchange -> encrypt+store token -> resolve for API calls + revoke. This is more convenient, but holding keys to customer Cloudflare accounts is a bigger security and trust commitment. Build it after the token path proves the funnel.

## Phased plan
**Phase A - prove the pipeline end-to-end with a manual token (de-risk first, ~days).**
Using a `CLOUDFLARE_API_TOKEN` for a test account, run the full managed deploy of booking: provision -> migrate -> upload (needs a ready artifact, so do Phase B's build manually first) -> inject email relay -> live -> actually log in and make a booking. Validates the core requirements with zero OAuth/UI work. If this works, the model is real.

**Phase B - prebuilt artifact pipeline (unblock BLOCKER 1).**
CI builds booking-sveltekit -> stores the upload-ready artifact (R2 + artifact record) per template+version. Deploy consumes the stored artifact (no user/Worker build). Add a readiness gate in CI so a broken artifact never ships.

**Phase C - self-serve auth + UX.**
Ship the **API-token-paste** path first: a "Deploy to your Cloudflare" flow -> paste scoped token -> progress UI (provisioning -> migrating -> deploying -> live). Then optionally build **OAuth** as the 1-click upgrade. Offer both; let the user choose (token = control, OAuth = convenience).

**Phase D - productionize.**
Email-relay cost controls + rate-limit per account; audit log of every action we take in a user's account; failed-deploy cleanup; then replicate to saas/portal (each needs a prebuilt artifact + its migrations).

## Hard parts / risks (honest)
- **OAuth = holding keys to customers' Cloudflare accounts** - encryption, least-privilege scopes, revocation, audit. Big security/liability surface; do not rush it. The token-paste path sidesteps most of it.
- **Trust ask** conflicts with the security-ICP ethos - lead with scoped token + "revoke anytime", make OAuth optional.
- **Email relay** = our ongoing cost + spam surface (every deployed app sends via us). Rate-limit; consider "bring your own email key to remove our branding/limits."
- **Per-template prebuild** must stay in lockstep with template changes (CI gate).
- **Premature scaling:** still 0 pilots - Phase A/B are cheap validation; gate C/D on a real "I'd deploy this" signal.

## Recommended first step
**Phase A + the booking artifact build** - manually prove provision -> migrate -> upload -> live -> login works into a test Cloudflare account with a pasted token. That single end-to-end run tells you whether the whole "we handle it for them" promise holds, before building any OAuth or UI.
