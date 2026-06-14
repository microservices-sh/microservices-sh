---
name: prisma-postgres-to-d1
description: Migrate a Prisma + Postgres data layer to Drizzle on Cloudflare D1 inside a microservices.sh app. Use when a user has an existing Prisma schema and Postgres database (Neon, Supabase, RDS, self-hosted) and wants to move queries and data onto D1. Covers schema translation, query rewrites, data export/transform/import, and verification.
---

# Prisma + Postgres → Drizzle + D1

## Overview

Use this skill to move a Prisma/Postgres data layer onto Cloudflare D1 (SQLite) with Drizzle inside a microservices.sh app. This is a focused data-layer migration — pair it with `supabase-to-microservices` or `firebase-to-microservices` when the source also has auth/storage/realtime to move.

D1 is SQLite. The migration is mostly: translate `schema.prisma` → Drizzle schema, rewrite Prisma Client calls → Drizzle, and move Postgres rows into SQLite. Where a microservices.sh module already owns a table (`customer`, `booking`), extend it via config/overlay rather than redefining it.

This is plan-first and approval-gated. Importing data crosses into the user's real records — never apply remote changes without explicit approval.

## Type & Feature Mapping

Postgres/Prisma → SQLite/Drizzle:

| Prisma / Postgres | D1 / Drizzle | Notes |
| --- | --- | --- |
| `String @id @default(uuid())` | `text` primary key | Generate ids in app, not DB |
| `Int @id @default(autoincrement())` | `integer primary key autoincrement` | |
| `DateTime` | `integer` (epoch ms) or `text` (ISO) | SQLite has no native date type |
| `Boolean` | `integer` 0/1 | |
| `Json` | `text` + JSON helpers | No native jsonb |
| `Decimal` | `text` or `integer` (minor units) | No exact decimal; store money as integer cents |
| `enum` | `text` + app-side check | No native enum |
| `String[]` / scalar lists | join table or `text` (JSON) | No native arrays |
| `@relation` FKs | Drizzle `references()` + index | D1 enforces FKs only with pragma on |
| `@@index` / `@@unique` | Drizzle `index()` / `unique()` | Recreate explicitly |

Flag anything Postgres-specific with no clean SQLite equivalent up front: `jsonb` operators, full-text search, window-function-heavy queries, `Decimal` precision, stored procedures, materialized views.

## Workflow

### 1. Assess the schema

- Read `schema.prisma`: models, fields, relations, indexes, enums, defaults.
- Find Postgres-specific features in queries (raw SQL, `jsonb` ops, FTS, CTEs/windows).
- Get row counts per table (sizes the import and checks against D1 limits).

### 2. Scaffold or target the app

If starting fresh:

```bash
pnpm create microservices-app@latest <app-name> --template <template-id>
cd <app-name>
pnpm install
pnpm microservices local setup
```

If the app exists, work in it. Check which entities a module already owns:

```bash
pnpm microservices modules list --json
pnpm microservices docs <module-id>
```

Do not redefine a module-owned table — extend via documented config/overlay.

### 3. Translate the schema to Drizzle

- Convert each Prisma model to a Drizzle table using the mapping above.
- Recreate relations as `references()` and add every `@@index`/`@@unique`.
- Move id generation into the app (uuid/text) since D1 defaults differ.
- Validate locally:

```bash
pnpm microservices check --json
```

### 4. Rewrite the queries

- Replace Prisma Client calls with Drizzle query-builder equivalents (`findMany`→`select`, `create`→`insert`, `update`, `delete`, relation loads→joins).
- Replace `$queryRaw` Postgres SQL with SQLite-compatible SQL.
- Re-express `jsonb`/array/FTS logic as app code, join tables, or D1 features.
- Keep queries behind the module/use-case boundary, not in route handlers.

### 5. Move the data

- Export Postgres data (`pg_dump --data-only`, COPY to CSV, or a script).
- Transform values to SQLite types: timestamps→epoch/ISO, booleans→0/1, JSON→text, decimals→integer cents, arrays→join rows.
- Load into **local** D1 first; verify counts and sample joins before any remote import.
- Remote D1 import is approval-gated — treat it like writing to production.

### 6. Verify

```bash
pnpm dev
pnpm microservices local smoke
pnpm microservices check --json
```

Verify row counts match source, foreign keys resolve, unique constraints hold, and rewritten queries return equivalent results on a sample. Only after local verification, plan the approval-gated remote deploy and import.

## Approval Gates

Ask for explicit approval before:

- Importing data into remote D1 or any production resource.
- Provisioning Cloudflare resources, secrets, or deploying.
- Decommissioning the source Postgres database (confirm backups first).

Never ask the user to paste secret values (database URLs, credentials) into chat. Discuss names, scopes, and where to set them.

## Finish Checklist

Report:

- Schema translation decisions and any Postgres features dropped or reworked.
- Query rewrites done and which ran clean vs needed manual SQL.
- Data transforms applied and verified row counts.
- Approval-gated work planned but not executed (remote import, deploy, source teardown).
