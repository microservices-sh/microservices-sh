---
name: microservices-data-migration
description: Plan and perform local-first data migrations into microservices.sh apps. Use for moving data from Supabase, Firebase, Postgres/Prisma, SQL dumps, CSV exports, legacy APIs, auth users, files, or provider records into D1, R2, modules, and generated templates.
---

# microservices.sh Data Migration

Use this skill for source-to-microservices.sh data moves. Prefer specific migration skills when they match exactly, but keep this skill as the generic path for mixed or custom sources.

## Route To Specific Skills

- Use `supabase-to-microservices` for Supabase Postgres/Auth/Storage/Realtime/Edge Functions.
- Use `firebase-to-microservices` for Firestore/Auth/Storage/Cloud Functions/FCM.
- Use `prisma-postgres-to-d1` for Prisma/Postgres schema and query migrations.
- Use `express-api-to-workers` when the migration includes an Express/Fastify/Koa/Nest API runtime move.

If none match, continue here.

## Migration Workflow

1. Inventory source data: entities, relationships, row/document counts, auth users, files, provider records, background jobs, and access rules.
2. Map each entity to a module-owned table, template overlay, R2 object model, or custom D1 table. Read `references/source-mapping.md`.
3. Preserve identifiers where they link history, invoices, bookings, files, or audit records.
4. Translate auth carefully. Passwords, OAuth tokens, phone auth, and provider sessions usually cannot be carried over; plan re-verification.
5. Write idempotent import scripts or one-off migrations that can be rerun safely.
6. Import into local D1/R2 first. Verify counts, samples, foreign keys, permissions, and former access rules.
7. Plan remote import separately and ask for explicit approval before touching remote data.

## Data Rules

- Do not paste or request production data in chat.
- Do not put PII in logs, generated docs, telemetry props, or commit messages.
- Never import into remote D1/R2 before local verification and user approval.
- Keep source backups until verification and rollback planning are complete.
- Record source-to-target mappings and irreversible transforms.

## Finish Checklist

Report:

- Source surfaces and target modules/tables/buckets.
- Non-1:1 mappings and user-visible behavior changes.
- Import method and idempotency strategy.
- Local verification results: counts, samples, access checks.
- Remote steps planned but not executed.
