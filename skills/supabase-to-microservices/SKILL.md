---
name: supabase-to-microservices
description: Migrate a Supabase application to a microservices.sh app on Cloudflare. Use when a user wants to move off Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) onto microservices.sh templates and modules backed by D1, R2, Durable Objects, and Workers. Covers source assessment, concept mapping, scaffolding a new app, schema and data migration into D1, auth cutover to email-code, and verification.
---

# Supabase → microservices.sh

## Overview

Use this skill to move an existing Supabase project onto a microservices.sh app running on Cloudflare. The target is a generated, user-owned app (D1 + KV + R2 + Workers, SvelteKit runtime) composed from published modules. Do not rebuild Cloudflare primitives by hand when a module already owns that surface — map Supabase concepts to modules first, scaffold, then move data.

This is plan-first and approval-gated. Migrating data, auth, and secrets crosses into the user's real users and records — never apply remote changes without explicit approval.

## Concept Mapping

Map Supabase surfaces to microservices.sh equivalents before writing code:

| Supabase | microservices.sh target | Notes |
| --- | --- | --- |
| Postgres tables | D1 (SQLite) via Drizzle schema | Type/feature differences below |
| Row Level Security (RLS) | App/module permission checks at the Worker boundary | No DB-enforced RLS in D1; enforce in code |
| Supabase Auth (email/password, magic link, OAuth) | Platform email-code (passwordless) auth | Password and social login do not map 1:1 — confirm with user |
| Storage buckets | R2 buckets | Public/signed URL model differs |
| Realtime (postgres changes, broadcast, presence) | Durable Objects (`durable-objects` skill) | No drop-in; rebuild as DO + WebSocket |
| Edge Functions (Deno) | Workers / module use-case files | Rewrite Deno APIs to Workers runtime |
| `pg_cron` | Cloudflare Cron Triggers | |
| pgvector | Vectorize | |

Flag every row where the mapping is not 1:1 (RLS, password/OAuth auth, realtime) to the user up front. These are the migration's real cost, not the table copy.

## Workflow

### 1. Assess the source

Inventory before moving anything:

- Tables, columns, types, foreign keys, indexes — export from Supabase (`supabase db dump` or Dashboard → Database → Schema).
- RLS policies per table (these become Worker-side permission checks).
- Auth providers in use (email/password, magic link, OAuth) and the `auth.users` shape.
- Storage buckets and access rules.
- Realtime subscriptions and Edge Functions.
- Row counts per table (sizes the data migration and D1 limits).

Report what maps cleanly vs what needs a rewrite before scaffolding.

### 2. Pick template and modules

Choose the closest published template, then optional modules that already own a mapped surface:

```bash
pnpm create microservices-app@latest <app-name> --template <template-id>
cd <app-name>
pnpm install
pnpm microservices local setup
```

- Use a `customer`-backed template when Supabase rows model people/accounts.
- Add `email` for transactional mail (replaces Supabase auth emails / SMTP).
- Add `payment-stripe` if the source app billed users.
- Confirm template/module availability with `pnpm microservices modules list --json`; if a needed surface has no module, build it as an overlay, not by forking module internals.

If templates are not yet publicly released, say so and stop — do not invent a template id.

### 3. Translate the schema to D1/Drizzle

- Convert Postgres types to SQLite/Drizzle: `uuid`→`text`, `timestamptz`→`integer`(epoch) or `text`(ISO), `jsonb`→`text` + JSON helpers, `serial`→`integer primary key autoincrement`, `boolean`→`integer 0/1`, arrays/enums→`text`.
- Recreate foreign keys and indexes in the Drizzle schema; D1 does not enforce RLS.
- Where a module already owns a table (customer, booking), extend via documented config/overlay rather than redefining it.
- Generate and review the migration locally:

```bash
pnpm microservices check --json
```

### 4. Move the data

- Export Supabase data as CSV/SQL per table.
- Transform values to match the D1 column types (timestamps, JSON, booleans, uuids).
- Load into **local** D1 first and verify counts and a sample of joins before any remote import.
- Remote D1 import is approval-gated — treat it like writing to production.

### 5. Cut over auth

- Platform auth is passwordless email-code. Supabase email/password and OAuth users cannot carry passwords over; plan a re-verification (users sign in by email code on first visit).
- Preserve user identity by importing `auth.users` email + stable id into the `customer`/users table so history links.
- Map RLS policies to explicit permission checks at the Worker boundary and in module hooks.
- Confirm the auth contract with the user before removing any Supabase login UI.

### 6. Storage, realtime, functions

- Copy Storage objects into R2; update access from Supabase signed URLs to R2 equivalents.
- Rebuild Realtime as Durable Objects (`durable-objects` skill) — there is no drop-in.
- Port Edge Functions (Deno) to Workers / module use-case files; replace Deno-specific APIs.

### 7. Verify

```bash
pnpm dev
pnpm microservices local smoke
pnpm microservices check --json
```

Verify row counts match source, auth login works via email code, foreign-key integrity holds, and former RLS rules are enforced in code. Only after local verification, plan the approval-gated remote deploy and remote data import.

## Approval Gates

Ask for explicit approval before:

- Importing data into remote D1 or any production resource.
- Cutting over auth or invalidating existing user sessions.
- Copying user PII or Storage objects to R2.
- Provisioning Cloudflare resources, secrets, or deploying.
- Decommissioning the Supabase project (irreversible — confirm backups first).

Never ask the user to paste secret values into chat. Discuss secret names, scopes, and where to set them.

## Finish Checklist

Report:

- Which Supabase surfaces were mapped, which were rewritten, and which were dropped.
- Template/modules chosen and why.
- Schema/data transforms applied and verified row counts.
- Auth cutover plan and remaining user-facing steps (email re-verification).
- Approval-gated work planned but not executed (remote import, deploy, Supabase teardown).
