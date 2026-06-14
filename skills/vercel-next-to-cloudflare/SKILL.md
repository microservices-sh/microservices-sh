---
name: vercel-next-to-cloudflare
description: Move a Vercel-hosted Next.js app onto Cloudflare and, where it fits, onto a microservices.sh app. Use when a user wants off Vercel/Next for hosting, edge runtime, KV, Postgres, Blob, or cron. Honest about fit — microservices.sh templates are SvelteKit, so this skill separates a generic Cloudflare host move from a deeper rebuild onto microservices.sh modules. Covers hosting options, infra mapping, data/auth migration, and verification.
---

# Vercel + Next.js → Cloudflare

## Overview

Use this skill to move a Vercel-hosted Next.js app onto Cloudflare. Be honest about scope: **microservices.sh templates are SvelteKit**, so there is no Next.js template to drop into. This skill covers two distinct paths — pick one with the user before doing work:

1. **Host-level move** — keep Next.js, deploy on Cloudflare Workers (via `@opennextjs/cloudflare`) and map Vercel infra to Cloudflare primitives. No microservices.sh involvement. For this path, lean on the global `cloudflare`, `workers-best-practices`, and `wrangler` skills.
2. **Rebuild onto microservices.sh** — re-platform the backend (data, auth, modules) onto a microservices.sh app and treat the Next.js frontend as a client, or rebuild the UI on the SvelteKit template. Use the migration skills below for each backend surface.

Do not pretend path 1 lands on microservices.sh modules — it does not. Confirm the path first.

## Infra Mapping (path 1)

| Vercel / Next.js | Cloudflare target | Notes |
| --- | --- | --- |
| Next.js on Vercel | Next.js via `@opennextjs/cloudflare` on Workers | Not all Next features map 1:1; check version support |
| Edge Middleware / Edge runtime | Workers / Next middleware on OpenNext | Behavior differences exist |
| Vercel KV | Cloudflare KV | |
| Vercel Postgres | D1 (`prisma-postgres-to-d1`) or external Postgres over HTTP | D1 is SQLite — see that skill |
| Vercel Blob | R2 | |
| Vercel Cron | Cloudflare Cron Triggers | |
| Image Optimization | Cloudflare Images / loader | Reconfigure the Next image loader |
| ISR / on-demand revalidation | OpenNext cache (KV/R2/D1-backed) | Configure the OpenNext cache adapter |
| Environment variables | Worker bindings + secrets | |
| NextAuth / Vercel auth | Keep, or move to platform email-code auth (path 2) | |

Flag features without clean support up front: ISR/revalidation specifics, edge middleware behavior, image optimization, and any RSC/streaming edge cases under OpenNext.

## Workflow

### Path 1 — host-level move (keep Next.js)

1. **Assess** Next.js version, app vs pages router, edge vs node runtime, and which Vercel products are used (KV, Postgres, Blob, Cron, Image, ISR).
2. **Adopt OpenNext for Cloudflare** — add `@opennextjs/cloudflare`, configure `wrangler` and the OpenNext cache adapter. Defer to the global `cloudflare` / `workers-best-practices` / `wrangler` skills for current config.
3. **Map infra** per the table: KV→KV, Postgres→D1 or external, Blob→R2, Cron→Cron Triggers, env→bindings/secrets, image loader→Cloudflare Images.
4. **Move data** with `prisma-postgres-to-d1` if leaving Vercel Postgres for D1.
5. **Verify** locally with `wrangler dev`, then a preview deploy. Check routing, middleware, ISR/revalidation, images, and API routes behave as on Vercel.

This path produces a Cloudflare-hosted Next.js app, not a microservices.sh app. Stop here unless the user wants path 2.

### Path 2 — rebuild backend onto microservices.sh

1. Scaffold a microservices.sh app:

```bash
pnpm create microservices-app@latest <app-name> --template <template-id>
cd <app-name>
pnpm install
pnpm microservices local setup
```

2. Map backend surfaces to modules and use the matching migration skill:
   - Data layer → `prisma-postgres-to-d1`, `supabase-to-microservices`, or `firebase-to-microservices` (whatever the source uses).
   - API routes (`app/api`, route handlers) → `express-api-to-workers` patterns: thin handlers delegating to modules/use-cases.
   - Auth (NextAuth/Clerk/etc.) → platform email-code auth; plan re-verification since passwords/OAuth do not carry over.
   - Payment endpoints → `payment-stripe`; mail → `email`.
3. Decide the frontend: keep the Next.js client calling the new backend, or rebuild the UI on the SvelteKit template. Say plainly that reusing Next UI on the SvelteKit template is a rewrite, not a port.
4. Verify:

```bash
pnpm dev
pnpm microservices local smoke
pnpm microservices check --json
```

## Approval Gates

Ask for explicit approval before:

- Importing data into remote D1 or any production resource.
- Cutting over auth or invalidating existing user sessions.
- Provisioning Cloudflare resources, secrets, or deploying.
- Changing DNS / pointing the production domain off Vercel (confirm rollback first).
- Decommissioning the Vercel project (confirm backups first).

Never ask the user to paste secret values into chat. Discuss names, scopes, and where to set them.

## Finish Checklist

Report:

- Which path was chosen (host move vs microservices.sh rebuild) and why.
- Infra surfaces mapped and any Next/Vercel features dropped or reworked.
- Which migration skills were used for data/api/auth (path 2).
- Frontend decision (kept Next client vs SvelteKit rebuild).
- Approval-gated work planned but not executed (DNS cutover, remote import, deploy, Vercel teardown).
